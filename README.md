# exif-renamer

A NodeJS library & shell command to rename photos using their EXIF data.
It can also be set to watch a directory and automatically process images copied to it.

[![Gitter chat](https://badges.gitter.im/dylansmith/node-exif-renamer.png)](https://gitter.im/dylansmith/node-exif-renamer)

## Installation

To use it as a dependency in your Node project, install it locally using:

```bash
$ npm install exif-renamer --save
```

To use it as a command line tool, install it globally using:

```bash
$ npm install exif-renamer -g
```

## Usage

### as a library

```javascript
var exifRenamer = require('exif-renamer')(opts);

exifRenamer.rename('path/to/image.file', '{{datetime "yyyy-mm-dd"}}_{{file}}', function(err, result) {
    console.log((err) ? err : 'the file was renamed: ', result.processed.path);
});
```

### as a shell command

```bash
$ exif-renamer -h

Usage:
  exif-renamer [OPTIONS] [ARGS]

Options:
  -c, --no_ctime         do not use the ctime fallback if no EXIF data is present
                         (also sets require_exif=true)
  -d, --dryrun           run without performing filesystem changes
  -e, --exif             get the exif data for the specified image
  -f, --filetypes STRING comma-separated list of file extensions to process
                         (jpg and jpeg are default)
  -o, --overwrite        overwrite existing files
  -r, --recursive        recursively process the specified directory
  -t, --template [STRING]renaming template (Default is {{datetime}}_{{file}})
  -w, --watch            watch the specified directory for changes and
                         process automatically
  -h, --help             Display help and usage details
```

## Documentation

### Configuration

The following configuration options are available when using _exif-renamer_ as a library
(the default values are show below):

```javascript
{
    dryrun: false,                          // simulate processing without modifying the filesystem
    fallback_ctime: true,                   // fallback to filesystem ctime if no EXIF DateTimeOriginal
    overwrite: false,                       // overwrite existing files?
    require_exif: false,                    // fail if EXIF data is not found?
    path_separator: '/',                    // the character used to separate paths in templates
    formats: {
        datetime: 'yyyymmdd-HHMMss',        // default formatting for {{datetime}}
        date: 'yyyymmdd',                   // default formatting for {{date}}
        time: 'HHMMss'                      // default formatting for {{time}}
    },
    valid_extensions: ['jpg','jpeg','tiff'] // supported file extensions for processing
};
```

To update configuration, do the following:

```javascript
var exifRenamer = require('exif-renamer');
exifRenamer.config.dryrun = true;
```

### Renaming templates

The #process and #rename methods accept a `template` argument which is used to determine the new
filename for the renamed image. As the name might suggest, the template is a way for you to format
the filename using values present in the EXIF data.

_exif-renamer_ uses [Handlebars](http://handlebarsjs.com/) for templating, which allows you to
easily access the image file metadata to construct just about any filename you could imagine, e.g.:

> Prefix the filename with the default datetime format:<br>
> `{{datetime}}_{{file}}`

> Prefix the filename with a custom datetime format (see [dateformat](https://www.npmjs.org/package/dateformat)):<br>
> `{{datetime "yy-mm"}}_{{file}}`

> Move the image to a "YYYY-MM" directory:<br>
> `./{{datetime "yyyy-mm"}}:{{file}}`

> Prefix the parent directory with the date:<br>
> `../{{date}} {{dirname}}:{{file}}`

> Prefix the filename with the file extension and camera model:<br>
> `{{EXT}}-{{exif.Model}}-{{file}}`

> Prefix the filename with the F-number:<br>
> `F{{exif.FNumber}}-{{file}}`

Some things to point out:

- The renaming pattern has the format `[<directory_pattern>:]<filename_pattern>`, where
  `<directory_pattern>` is optional and defaults to the image's current directory.
  Absolute or relative paths can be used in the template.
- `{{datetime}}` is currently the only metadata that supports additional formatting, via the
  [dateformat module](https://www.npmjs.org/package/dateformat) as mentioned above.
- if a template variable is used that is not found in the image metadata, it is simply ignored and
  an empty string is used as a replacement.

#### Custom renaming

It is possible to pass your own custom function rather than a handlebars template, giving you total
control over the renaming process. Here is an example:

```javascript
function dogeify(metadata) {
    var dogeisms = ['very', 'wow', 'so', 'much'];
    return [
        dogeisms[Math.floor(Math.random() * dogeisms.length)],
        'F' + metadata.exif.FNumber,
        metadata.file
    ].join('_');
}

exifRenamer.process('path/to/image.file', dogeify, function(err, result) {
    //...
});
```

#### Metadata

The metadata available to your handlebar template or custom renaming function is a combination of
the exif data generated by the [exif-parser module](https://www.npmjs.org/package/exif-parser),
path information, and some other useful stuff:

```
{
    // EXIF data
    'exif':     <see: https://github.com/bwindels/exif-parser/blob/master/lib/exif-tags.js>,
    'gps':      <see: https://github.com/bwindels/exif-parser/blob/master/lib/exif-tags.js>,

    // path information
    'path':     <the absolute path to the image>,
    'file':     <the image filename with extension>,
    'name':     <the image filename without extension>,
    'dir':      <the directory path>,
    'dirname':  <the directory name>,
    'ext':      <the lowercase image extension>,
    'EXT':      <the uppercase image extension>,
    'stat':     <see: http://nodejs.org/api/fs.html#fs_class_fs_stats>,

    // other useful stuff
    'datetime': <EXIF date or ctime>,
    'date':     <EXIF date formatted using the value of config.formats.date>,
    'time':     <EXIF time formatted using the value of config.formats.time>
}
```

### Methods

#### #exif

Returns the EXIF data for an image.

##### arguments

- `filepath` the path to the image file
- `callback` the node-style callback that will receive the response

##### usage

```javascript
exifRenamer.exif('path/to/image.file', function(err, exifdata) {
    //...
});
```

* * *

#### #process

Returns an object containing the renaming outcome for the specified image,
but does not actually rename the image (see #rename for this).

##### arguments

- `filepath` the path to the image file
- `template` the renaming template or a custom callback function
- `callback` the node-style callback that will receive the response

##### usage

```javascript
// using a handlebars template
exifRenamer.process('path/to/image.file', 'renaming-template', function(err, result) {
    //...
});

// using a custom function
exifRenamer.process('path/to/image.file', customRenamer, function(err, result) {
    //...
});
```

* * *

#### #rename

Renames/moves the specified image using the provided template/callback.

##### arguments

- `filepath` the path to the image file
- `template` the renaming template or a custom callback function
- `callback` the node-style callback that will receive the response

##### usage

```javascript
// using a handlebars template
exifRenamer.rename('path/to/image.file', 'renaming-template', function(err, result) {
    //...
});

// using a custom function
exifRenamer.rename('path/to/image.file', customRenamer, function(err, result) {
    //...
});
```

* * *

#### #rename_dir

Renames/moves all applicable images in the specified directory,  using the provided
template/callback.

##### arguments

- `filepath` the path to the image file
- `template` the renaming template or a custom callback function
- `[recursive=false]` boolean switch to enable recursive processing, defaults to false
- `callback` the node-style callback called once all files have been processed
- `itemCallback` the node-style callback called after each file is processed

##### usage

```javascript
// using a handlebars template
exifRenamer.rename('path/to/image.file', 'renaming-template', function(err, result) {
    //...
});

// using a custom function
exifRenamer.rename('path/to/image.file', customRenamer, function(err, result) {
    //...
});
```

* * *

#### #watch

Watches a specified directory, renaming all images that are added to that directory.

##### arguments

- `dirpath`  the path to the watch directory
- `template` the renaming template or a custom callback function
- `callback` the node-style callback that will be called each time a file is detected & processed

##### usage

```javascript
exifRenamer.watch('path/to/watch/dir', 'renaming-template', function(err, result) {
    //...
});
```

* * *

## Support

This software is free and open source and maintained by just one guy who has a day job.
If you have a feature request or bug report please
[open an issue on GitHub](https://github.com/dylansmith/node-exif-renamer/issues) or
[discuss it on Gitter](https://gitter.im/dylansmith/node-exif-renamer).

## Contributing

If you are a developer please feel free to get involved and send a pull request with
your enhancements or bugfix.

## Roadmap
* Swap out Grunt for Gulp

## Release History
* 1.0.0
  * No changes from 0.7.0, which was a good RC for 1.0.0
* 0.7.0
  * Fixed [#3](https://github.com/dylansmith/node-exif-renamer/issues/3):
    * `#rename_dir` now takes an `itemCallback` which is called after each file is processed
  * Fixed [#4](https://github.com/dylansmith/node-exif-renamer/issues/4):
    * Improved logging and error handling
    * improved readability of cli output reporter
  * Fixed [#5](https://github.com/dylansmith/node-exif-renamer/issues/5):
    * Replaced the EXIF parsing library from [exif](https://www.npmjs.com/package/exif) to
      [exif-parser](https://www.npmjs.com/package/exif-parser) to fix issues with date
      parsing. This does however change the structure of the metadata object used in
      templating (all EXIF tag values now exist within the `exif` and `gps` keys only).
  * Other improvements:
    * `require_exif` config option now defaults to false
    * `-c` cli switch will now also set `require_exif` to true
* 0.6.1
  * fixed https://github.com/dylansmith/node-exif-renamer/issues/1
* 0.6.0
  * changed the way the target directory is specified in renaming templates, since the current
    approach flattens relative paths when doing recursive renaming. The renaming template now
    requires the directory and filename to be separated by a colon, e.g.:
    `[<directory_template>:]<filename_template>` (the directory is optional and defaults
    to the source image's directory).
  * Added TIFF support by default
* 0.5.0
  * added mocha specs with instanbul coverage reports
  * altered some method signatures
  * methods are no longer wrapped with Q internally
  * much refactor, so bugfix, wow
* 0.4.0 - added explicit template pathing (breaking changes), overwrite protection, and refactoring
* 0.3.0 - added #rename_dir with recursive option, ctime fallback and a shell interface
  ([commit](https://github.com/dylansmith/node-exif-renamer/commit/99607cab9eebeed56110490c1f6fc246d87479b2))
* 0.2.0 - introduced handlebars-based templating
  ([commit](https://github.com/dylansmith/node-exif-renamer/commit/c53a1bde6c57f86f5db9e773e15840d9f0a7f9cc))
* 0.1.0 - initial version, work in progress
  ([commit](https://github.com/dylansmith/node-exif-renamer/commit/3b9071facf03f5ca74bb48f75355ff8e7d132670))

## License
Copyright (c) 2014 Dylan Smith
Licensed under the MIT license.
