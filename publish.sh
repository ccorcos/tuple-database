set -e

rm -rf build
npm run build
cp package.json build
cp .npmignore build
cp README.md build

cd build
npm publish
cd ..