set -e

# npm version patch

rm -rf build
npm run build:macros

# Fix tsconfig and compile so that source maps work.
cp -r src build
cp tsconfig.json build
sed -i '' 's#"src/#"#g' build/tsconfig.json
sed -i '' 's#"build"#"."#g' build/tsconfig.json
./node_modules/.bin/tsc -p build/tsconfig.json

cp package.json build
cp .npmignore build
cp README.md build


cd build
npm publish
cd ..