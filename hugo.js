'use strict';

let config = {
  root: 'example', //Root hugo folder, can be empty
  dataFolder: 'data', //Data folder path (will fetch ALL files from here)
  type: 'article', //Type name [basically layout] (save it under "layouts/NAME/single.html" or themes/THEME/layouts/NAME/single.html). Can be overridden on individual pages by defining "type" under "fields"
  pages: 'articles', //Pages elemenet in your data, in case it's "posts" or "articles" etc.
  contentPath: 'content', //Path to content directory (in case it's not "content")
  hugoPath: '/snap/bin/hugo' //Path to hugo binary (if global, e.g. /snap/bin/hugo)
}

const fs = require('fs');
const fse = require('fs-extra');
const prompts = require('prompts');

const converToObject = (file) => {
  const jsyml = require('js-yaml');
  const jstml = require('toml');
  const filetype = file.split('.').pop();
  const fileContent = fs.readFileSync(config.root + config.dataFolder + '/' + file, 'utf8');
  if (filetype === 'json') return JSON.parse(fileContent);
  if (filetype === 'yml' || filetype === 'yaml') return jsyml.safeLoad(fileContent);
  if (filetype === 'toml') return jstml.parse(fileContent);
};
const build = async (add, force) => {
  if (typeof add === 'undefined') add = true;
  if (typeof force === 'undefined') force = false;
  if (!config.contentPath || config.contentPath === '/') return console.log('Error: config.contentPath cannot be \'\' or \'/\')!');
  let dataFiles;
  try {
    dataFiles = fs.readdirSync(config.root + config.dataFolder);
  } catch (e) {
    return console.log('e', e);
  }
  if (dataFiles.length < 1) return console.log('No data files');
  for (let i in dataFiles) {
    if (dataFiles[i].includes(config.pages)) {
      let pages = converToObject(dataFiles[i]);
      for (let j in pages) {
        if (!pages[j]) return console.log('Error: Pages must include fields!');
        if (!pages[j].slug) return console.log('Error: Pages must include slug!');
        if (!pages[j].type) pages[j].type = config.type;

        const pagePath = config.root + config.contentPath + '/' + pages[j].slug;
        if (add) {
          //fse.ensureDirSync(pagePath);
          try {
            fs.writeFileSync(pagePath + '.md', JSON.stringify(pages[j]) + '\n');
            console.log('Created file: ' + pagePath + '.md');
          } catch (e) {
            return console.log('e', e);
          }
          try {
            dataFiles = fs.readdirSync(config.root + config.dataFolder);
            fs.writeFileSync(pagePath + '.json', JSON.stringify(pages[j]) + '\n');
            console.log('Created file: ' + pagePath + '.json');
          } catch (e) {
            return console.log('e', e);
          }

        } else if (fs.existsSync(pagePath)) {
          let response;
          if (!force) {
            response = await prompts({
              type: 'confirm',
              name: 'value',
              message: 'Delete ' + pagePath + ' ?'
            });
          }

          if (force || response.value) {
            fse.removeSync(pagePath);
            console.log('Removed folder: ' + pagePath);
          }
        }
      }
    }
  }

};
const main = async (argvs) => {
  const mode = typeof argvs._[0] === 'undefined' ? 'default' : argvs._[0];
  const force = typeof argvs['force'] === 'undefined' ? false : true;
  const configFile = typeof argvs['configFile'] === 'undefined' ? false : require('./' + argvs['configFile']);
  Object.assign(config, configFile); //overriding default settings
  config.root = (!!config.root ? config.root : '.') + '/';
  const { execSync } = require('child_process');
  if (mode === 'server') {
    //server mode - create data-generated files, run hugo server, remove data-generated files on stop
    console.log('Building data-generated files...');
    await build();
    console.log('Running Hugo Server...');
    process.on('SIGINT', () => {}); //Not exiting on ctrl+c (instead, going to "catch" clause)
    try {
      await execSync('(cd ' + config.root + ' && ' + config.hugoPath + ' server)');
    } catch (e) {
      console.log('Removing data-generated files...');
      await build(false, force);
    }
  } else if (mode === 'generate') {
    //generate - just create data-generated files (no hugo running, and no removal)
    console.log('Building data-generated files...');
    try {
      await build();
    } catch (e) {
      console.log('Build failed 😞');
      console.log(e);
    }
  } else if (mode === 'clean') {
    //clean - just remove data-generated files
    console.log('Removing data-generated files...');
    await build(false, force);
  } else {
    //default behavior - create data-generated files, run hugo build, remove data-generated files
    console.log('Building data-generated files...');
    try {
      await build();
    } catch (e) {
      console.log('Build failed 😞');
      console.log(e);
    }
    console.log('Running Hugo (build)...');
    try {
      await execSync('(cd ' + config.root + ' && ' + config.hugoPath + ' --minify)');
      console.log('Removing data-generated files...');
      await build(false, force);
    } catch (e) {
      console.log('Hugo failed 😞');
      console.log(e);
    }
  }

  console.log('Done!');
};

// Defining commands and flags
const argvs = require('yargs')
  .command('$0', 'Generate folders/files from data, then run `hugo build`')
  .command('generate', 'Generate folders/files from data (does not run hugo build)')
  .command('server', 'Generate folders/files from data, run `hugo server`, then cleanup on exit')
  .command('clean', 'Trigger cleanup manually')
  .option('force', {
    alias: 'f',
    description: 'Use this flag to skip folder removal prompts (be careful with this one!)'
  })
  .option('configFile', {
    alias: 'c',
    description: 'Optionally use an external config file (JSON format only)'
  })
  .argv;

main(argvs);
