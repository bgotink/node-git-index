import test from 'ava';
import {join} from 'path';
import {obj as objectStream} from 'through2';

import {streamChangedIndex} from '../lib';

const ROOT = join(__dirname, '_root');

/**
 * @param {string} directory
 * @return {Map<string, any>}
 */
async function performStream(directory) {
  return new Promise((resolve, reject) => {
    const result = new Map();

    streamChangedIndex(directory)
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

test('it should not result in any files when there are no staged changes', async t => {
  const files = await performStream('no-changes');

  t.is(files.size, 0);
});

test('it should not result in any files when there are no staged changesif the directory name ends with /', async t => {
  const files = await performStream('no-changes/');

  t.is(files.size, 0);
});

test('it should not result in any files when there are no staged changesfor process.cwd() if no directory is passed', async t => {
  process.chdir(join(ROOT, 'no-changes'));
  const files = await performStream();

  t.is(files.size, 0);
});

test('it should include staged changes', async t => {
  const files = await performStream('with-staged-changes');

  t.is(files.size, 1);

  t.true(files.has('bar.txt'));
  t.is(files.get('bar.txt').contents.toString(), 'This is bar\n');
});

test('it should not include unstaged changes', async t => {
  const files = await performStream('with-unstaged-changes');

  t.is(files.size, 1);

  t.true(files.has('baz.txt'));
  t.is(files.get('baz.txt').contents.toString(), 'This is baz\n');
});
