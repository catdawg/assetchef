#!/bin/sh -x -e

if [ ! -d "watchman/.git" ]
then
apt-get update
apt-get install autoconf automake build-essential python-dev libtool libssl-dev
rm -rf watchman
git clone https://github.com/facebook/watchman.git
cd watchman/
git checkout v4.9.0
./autogen.sh 
./configure --without-python --without-pcre
make
else
echo "watchman cache is there, skipping build, just installing with cache."
cd watchman/
fi

sudo make install