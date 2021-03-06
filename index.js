#!/usr/bin/env node

const arg = require('arg');
const path = require('path');
const fs = require('fs-extra');
const prompts = require('prompts');
const { promisify } = require('util');
const { convertFile } = require('convert-svg-to-png');
const expandHomeDir = require('expand-home-dir');
const { version } = require('./package.json');

const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);

const bold = '\x1b[1m';
const reset = '\x1b[0m';

function usage() {
  console.log(`
    ${bold}Usage${reset}:

      dusk-icons [<flags>]

    ${bold}Flags${reset}:

      -h, --help      Output usage information
      -v, --version   Show application version
  `);
}

function fail(msg) {
  console.log(`✖ ${msg}`);
}

function succeed(msg) {
  console.log(`✔ ${msg}`);
}

function hexMatch(str) {
  return /(^#[0-9A-F]{6}$)|(^#[0-9A-F]{3}$)/i.test(str);
}

async function convert(inputPath, outputPath) {
  const doesExist = await fs.pathExists(inputPath);

  if (!doesExist) {
    return false;
  }

  const output = await convertFile(inputPath, {
    height: 512,
    width: 512,
    outputFilePath: outputPath,
  });

  return output;
}

async function convertIcons(options) {
  const {
    output,
    fg,
    fg2,
    bg,
    icons,
  } = options;

  for (let icon of icons) {
    try {
      icon = icon.replace(' ', '_');
      const outputPath = path.resolve(output, `${icon}.png`);
      const inputPath = path.join(__dirname, `svg/${icon}.svg`);

      const exists = await fs.pathExists(inputPath);
      if (!exists) {
        fail(`Icon ${icon} does not exist.`);
        continue;
      }

      // Read the original svg file
      let tmpFile = await readFile(inputPath, 'utf-8');

      const map = {
        '#1e1e1e': bg,
        '#fff': fg,
        '#efefef': fg2,
      };

      // Replace with specified colors
      // Using function to avoid multiple replacements
      tmpFile = tmpFile.replace(
        /#1e1e1e|#fff|#efefef/gi,
        matched => map[matched.toLowerCase()],
      );

      // Write the temporary svg file
      const tmpFilePath = path.resolve(output, `${icon}-tmp.svg`);

      try {
        await writeFile(tmpFilePath, tmpFile, 'utf-8');
      } catch (err) {
        fail(`Error creating temporary svg file for ${icon}.`);
      }

      // Pass the temporary svg file to convert it
      const file = await convert(tmpFilePath, outputPath);

      // Check if conversion was successful
      if (!file) {
        fail(`Icon ${icon} does not exist.`);
      } else {
        succeed(`Generated ${icon} icon at ${file}`);
      }

      // Remove the generated temporary file
      await fs.remove(tmpFilePath);
    } catch (err) {
      console.log(err);
      process.exit(1);
    }
  }
}

async function convertAll(response) {
  const {
    output,
    fg,
    fg2,
    bg,
  } = response;

  // Get a list of all icons in the svg folder.
  // Filter out dotfiles, remove the .svg extension
  const icons = fs.readdirSync(path.join(__dirname, 'svg/'))
    .filter(icon => icon.endsWith('.svg'))
    .map(icon => icon.slice(0, -4));

  convertIcons({
    output,
    fg,
    fg2,
    bg,
    icons,
  });
}

async function start() {
  const questions = [
    {
      type: 'text',
      name: 'output',
      message: 'Output directory:',
      initial: '.',
      validate: async (value) => {
        let output = value;
        if (output.charAt(0) === '~') {
          output = expandHomeDir(output);
        }

        const exists = await fs.pathExists(output);
        if (!exists) {
          return 'This output path does not exist.';
        }

        return true;
      },
    },
    {
      type: 'text',
      name: 'fg',
      message: 'Primary foreground color:',
      initial: '#ffffff',
      validate: value => (!hexMatch(value) ? 'Please enter a valid hex code.' : true),
    },
    {
      type: 'text',
      name: 'fg2',
      message: 'Secondary foreground color:',
      initial: '#efefef',
      validate: value => (!hexMatch(value) ? 'Please enter a valid hex code.' : true),
    },
    {
      type: 'text',
      name: 'bg',
      message: 'Background color:',
      initial: '#1e1e1e',
      validate: value => (!hexMatch(value) ? 'Please enter a valid hex code.' : true),
    },
    {
      type: 'list',
      name: 'icons',
      message: 'Enter icons to generate:',
      initial: 'all',
      separator: ',',
    },
  ];

  try {
    const response = await prompts(questions, {
      onCancel: () => {
        fail('Cancelled dusk-icons.');
        process.exit(1);
      },
    });

    const { icons } = response;

    // Handle home directory paths
    if (response.output.charAt(0) === '~') {
      response.output = expandHomeDir(response.output);
    }

    if (icons.includes('all')) {
      try {
        await convertAll(response);
      } catch (err) {
        console.log(err);
        process.exit(1);
      }
    } else {
      convertIcons(response);
    }
  } catch (err) {
    console.log(err);
    process.exit(1);
  }
}

const args = arg({
  '--version': Boolean,
  '--help': Boolean,

  '-v': '--version',
  '-h': '--help',
}, {
  permissive: true,
});

if (args['--version']) {
  console.log(version);
  process.exit(1);
} else if (args['--help']) {
  usage();
  process.exit(1);
} else {
  start();
}
