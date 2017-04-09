import {spawn} from 'child_process';
import {mkdtemp} from 'fs';
import {tmpdir} from 'os';
import {basename, join as joinPath, resolve} from 'path';
import {obj as objectStream} from 'through2';
import * as File from 'vinyl';
import {src as vinylSrc, SrcOptions} from 'vinyl-fs';

const vinylSrcOptions: SrcOptions = {
  dot: true,
};

function createTemporaryDirectory(prefix: string): Promise<string> {
  return new Promise((resolve, reject) => {
    mkdtemp(joinPath(tmpdir(), prefix), (err, path) => {
      /* istanbul ignore if */
      if (err) {
        return reject(err);
      }

      resolve(path);
    });
  });
}

function git(cwd: string, ...args: string[]): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const proc = spawn('git', args, {
      cwd,
      stdio: ['ignore', 'pipe', 'ignore'],
    });

    let ended = false;
    const output: string[] = [];

    proc.stdout.on('data', buffer => {
      output.push(buffer.toString());
    });

    proc.on('error', /* istanbul ignore next */ e => {
      if (ended) {
        return;
      }

      ended = false;
      reject(e);
    });
    proc.on('close', (code, signal) => {
      /* istanbul ignore if: this is only true for errors */
      if (ended) {
        return;
      }
      ended = true;

      /* istanbul ignore else */
      if (code === 0) {
        resolve(output.join(''));
      } else {
        if (signal) {
          reject(new Error(`git killed with process ${signal}`));
        } else {
          reject(new Error(`git ended with code ${code}`));
        }
      }

      output.length = 0;
    });
  });
}

function streamDirectory(srcGlob: string|string[], fakeroot: string): NodeJS.ReadableStream {
  const filterFileStream =
      objectStream((file: File, _: any, cb: (err?: any, data?: File) => void) => {
        if (file.isDirectory()) {
          cb();
        } else {
          cb(null, file);
        }
      });

  const renameStream =
      objectStream((file: File, _: any, cb: (err?: any, data?: File) => void): void => {
        const {relative} = file;

        file.path = resolve(fakeroot, relative);
        file.base = fakeroot;

        cb(null, file);
      });

  const result = vinylSrc(srcGlob, vinylSrcOptions).pipe(filterFileStream).pipe(renameStream);

  filterFileStream.on('error', /* istanbul ignore next */ (e: any) => result.emit('error', e));
  renameStream.on('error', /* istanbul ignore next */ (e: any) => result.emit('error', e));

  return result;
}

function streamIndexFiles(
    directory: string, files: string[]|Promise<string[]>): NodeJS.ReadableStream {
  const result = objectStream();

  Promise.all([createTemporaryDirectory(basename(directory)), files])
      .then(([tmpDirectory, files]) => {
        return git(directory, 'checkout-index', '--prefix', `${tmpDirectory}/`, ...files)
            .then(() => {
              streamDirectory(joinPath(tmpDirectory, '**'), directory)
                  .pipe(objectStream((file: File, _: any, cb: () => void) => {
                    result.push(file);
                    cb();
                  }))
                  .on('finish',
                      () => {
                        result.end();
                      })
                  .on('error', /* istanbul ignore next */ (e: any) => {
                    result.emit('error', e);
                  });
            });
      })
      .catch(/* istanbul ignore next */ e => result.emit('error', e));

  return result;
}

/**
 * Stream the entire index. The resulting stream contains all files including symlinks, but no
 * directories, currently contained in the git repository. Staged changes are included but unstaged
 * changes are ignored.
 *
 * @param directory The directory (can be absolute or relative to the current directory), defaults
 * to the current directory
 * @return A stream of Vinyl files showing the current index content.
 */
export function streamIndex(directory: string = process.cwd()): NodeJS.ReadableStream {
  return streamIndexFiles(resolve(directory), ['-a']);
}

/**
 * Stream all changed files in the index. The resulting stream contains all files including
 * symlinks, but no directories, currently contained in the git repository. Staged changes are
 * included but unstaged changes are ignored.
 *
 * @param directory The directory (can be absolute or relative to the current directory), defaults
 * to the current directory
 * @return A stream of Vinyl files showing the current index content for all files with staged
 * changes.
 */
export function streamChangedIndex(directory: string = process.cwd()): NodeJS.ReadableStream {
  const srcDirectory = resolve(directory);

  return streamIndexFiles(
      srcDirectory,
      git(srcDirectory, 'diff', '--cached', '--name-only', '--diff-filter', 'ACM')
          .then(files => files.split('\n')));
}
