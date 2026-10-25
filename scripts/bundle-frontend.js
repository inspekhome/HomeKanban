'use strict';
const path=require('node:path');
const {bundleFrontend}=require('../app/frontend');
const packageRoot=process.argv[2];if(!packageRoot)throw Error('Supply the package directory.');
bundleFrontend(path.resolve(__dirname,'../app/public'),path.resolve(packageRoot,'app/public'));
