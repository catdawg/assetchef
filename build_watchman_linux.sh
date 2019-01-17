#!/bin/sh -x -e

if [ ! -d "watchman/.git" ]
then
rm -rf watchman
git clone https://github.com/facebook/watchman.git
git checkout v4.9.0
cd watchman/
./autogen.sh 
./configure 
make
else
echo "watchman cache is there, skipping build, just installing with cache."
cd watchman/
fi

sudo make install