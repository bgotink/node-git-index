import test from 'ava';
import {join} from 'path';
import {obj as objectStream} from 'through2';

import {streamIndex} from '../lib';

const ROOT = join(__dirname, '_root');

/**
 * @param {string} directory
 * @return {Map<string, any>}
 */
async function performStream(directory) {
  return new Promise((resolve, reject) => {
    const result = new Map();

    streamIndex(directory)
        .pipe(objectStream((file, _, cb) => {
          result.set(file.relative, file);
          cb();
        }))
        .on('error', reject)
        .on('finish', () => resolve(result));
  });
}

test.beforeEach('chdir to test/_root', () => {
  process.chdir(ROOT);
});

test('it should stream the index', async t => {
  const files = await performStream('no-changes');

  t.is(files.size, 2);

  t.true(files.has('README.md'));
  t.is(files.get('README.md').contents.toString(), '');

  t.true(files.has('foo.txt'));
  t.is(files.get('foo.txt').contents.toString(), 'This is foo\n');
});

test('it should stream the index if the directory name ends with /', async t => {
  const files = await performStream('no-changes/');

  t.is(files.size, 2);

  t.true(files.has('README.md'));
  t.is(files.get('README.md').contents.toString(), '');

  t.true(files.has('foo.txt'));
  t.is(files.get('foo.txt').contents.toString(), 'This is foo\n');
});

test('it should stream the index for process.cwd() if no directory is passed', async t => {
  process.chdir(join(ROOT, 'no-changes'));
  const files = await performStream();

  t.is(files.size, 2);

  t.true(files.has('README.md'));
  t.is(files.get('README.md').contents.toString(), '');

  t.true(files.has('foo.txt'));
  t.is(files.get('foo.txt').contents.toString(), 'This is foo\n');
});

test('it should include staged changes', async t => {
  const files = await performStream('with-staged-changes');

  t.is(files.size, 3);

  t.true(files.has('README.md'));
  t.is(files.get('README.md').contents.toString(), '');

  t.true(files.has('foo.txt'));
  t.is(files.get('foo.txt').contents.toString(), 'This is foo\n');

  t.true(files.has('bar.txt'));
  t.is(files.get('bar.txt').contents.toString(), 'This is bar\n');
});

test('it should not include unstaged changes', async t => {
  const files = await performStream('with-unstaged-changes');

  t.is(files.size, 4);

  t.true(files.has('README.md'));
  t.is(files.get('README.md').contents.toString(), '');

  t.true(files.has('foo.txt'));
  t.is(files.get('foo.txt').contents.toString(), 'This is foo\n');  // <-- not `was`!

  t.true(files.has('bar.txt'));
  t.is(files.get('bar.txt').contents.toString(), 'This is bar\n');

  t.true(files.has('baz.txt'));
  t.is(files.get('baz.txt').contents.toString(), 'This is baz\n');
});
