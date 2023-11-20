#!/bin/bash

set -e

rm -rf node_modules
rm -rf packages/*/node_modules
rm -rf packages/*/dist
rm -rf packages/*/build
rm -rf packages/*/tsconfig.tsbuildinfo
rm -rf packages/*/typechain-types
rm -rf packages/*/artifacts
rm -rf packages/*/artifacts-zk
rm -rf packages/*/cache
rm -rf packages/*/cache-zk
rm -rf packages/*/build