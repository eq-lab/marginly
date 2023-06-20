#!/bin/bash

set -e

rm -rf node_modules
rm -rf packages/*/node_modules
rm -rf packages/*/dist
rm -rf packages/*/build
rm -rf packages/*/tsconfig.tsbuildinfo
rm -rf packages/*/typechain-types
rm -rf packages/*/artifacts
rm -rf packages/*/cache
rm -rf packages/*/build

#echo "delete ./node_modules"
#rm -rf node_modules
#
#echo "delete ./cli/node_modules"
#rm -rf packages/cli/node_modules
#echo "delete ./cli/dist"
#rm -rf packages/cli/dist
#
#echo "delete ./contracts/node_modules"
#rm -rf packages/contracts/node_modules
#echo "delete ./contracts/typechain-types"
#rm -rf packages/contracts/typechain-types
#echo "delete ./contracts/artifacts"
#rm -rf packages/contracts/artifacts
#echo "delete ./contracts/cache"
#rm -rf packages/contracts/cache
#
#echo "delete ./contracts-uniswap-mock/node_modules"
#rm -rf packages/contracts-uniswap-mock/node_modules
#echo "delete ./contracts-uniswap-mock/typechain-types"
#rm -rf packages/contracts-uniswap-mock/typechain-types
#echo "delete ./contracts-uniswap-mock/artifacts"
#rm -rf packages/contracts-uniswap-mock/artifacts
#echo "delete ./contracts-uniswap-mock/cache"
#rm -rf packages/contracts-uniswap-mock/cache
#
#echo "delete ./deploy/dist"
#rm -rf packages/deploy/dist
#echo "delete ./deploy/node_modules"
#rm -rf packages/deploy/node_modules
#echo "delete ./deploy/tsconfig.tsbuildinfo"
#rm -f packages/deploy/tsconfig.tsbuildinfo
#
#echo "delete ./sbt/dist"
#rm -rf packages/sbt/dist
#echo "delete ./sbt/artifacts"
#rm -rf packages/sbt/artifacts
#echo "delete ./sbt/cache"
#rm -rf packages/sbt/cache
#echo "delete ./sbt/typechain-types"
#rm -rf packages/sbt/typechain-types
#echo "delete ./sbt/node_modules"
#rm -rf packages/sbt/node_modules
#
#echo "delete ./frontend/build"
#rm -rf packages/frontend/build
#echo "delete ./frontend/node_modules"
#rm -rf packages/frontend/node_modules
#
#echo "delete ./int-tests/artifacts"
#rm -rf packages/int-tests/artifacts
#echo "delete ./int-tests/node_modules"
#rm -rf packages/int-tests/node_modules
#echo "delete ./int-tests/cache"
#rm -rf packages/int-tests/cache
#echo "delete ./int-tests/dist"
#rm -rf packages/int-tests/dist