#!/bin/bash
#
# Create the test folders

## Helpers ##

function createRepo {
  mkdir "$1"
  cd "$1"

  git init
  touch README.md
  git add README.md
  git commit -m 'Initial commit'
}

function createFile {
  cat > "$1"
}

function createAndAddFile {
  createFile "$1"
  git add "$1"
}

function commit {
  git commit -m "${1:-Some commit message}"
}

function leaveRepo {
  cd ..
}

## Main execution ##

# bail on error
set -e

# cd to script location
cd "$(dirname "$0")"

# remove any leftovers from previous tests
if [ -d _root ]; then
  rm -rf _root
fi

# create wrapper directory for our folders
mkdir _root
cd _root

# create the repositories

createRepo no-changes
createAndAddFile 'foo.txt' <<EOF
This is foo
EOF
commit 'adding foo'
leaveRepo

createRepo with-staged-changes
createAndAddFile 'foo.txt' <<EOF
This is foo
EOF
commit 'adding foo'
createAndAddFile 'bar.txt' <<EOF
This is bar
EOF
leaveRepo

createRepo with-unstaged-changes
createAndAddFile 'foo.txt' <<EOF
This is foo
EOF
createAndAddFile 'bar.txt' <<EOF
This is bar
EOF
commit 'adding foo'
createAndAddFile 'baz.txt' <<EOF
This is baz
EOF
createFile 'foo.txt' <<EOF
This was foo
EOF
leaveRepo
