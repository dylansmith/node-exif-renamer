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

First, import the module:

```javascript
var exifRenamer = require('exif-renamer');
```

_exif-renamer_ supports node-style callbacks:

```javascript
exifRenamer.rename('path/to/image.file', '{{date "yyyy-mm-dd"}}_{{file}}', function(error, filename) {
    if (!error) {
        console.log('the file was renamed: ', filename);
    } else {
        console.log('an error occurred', error);
    }
});
```

It also supports promises (using the [Q library](https://www.npmjs.org/package/q)):

```javascript
exifRenamer
    .rename('path/to/image.file', '{{date "yyyy-mm-dd"}}_{{file}}')
    .then(function(filename) {
        console.log('the file was renamed: ', filename);
    })
    .catch(function(error) {
        console.log('an error occurred', error);
    })
    .done();
```
### as a shell command

```bash
$ exif-renamer -h

Usage:
  exif-renamer [OPTIONS] [ARGS]

Options:
  -c, --no_ctime         do not use the ctime fallback if no EXIF data is present
  -d, --dryrun           run without performing filesystem changes
  -e, --exif             get the exif data for the specified image
  -f, --filetypes STRING comma-separated list of file extensions to process
                         (jpg and jpeg are default)
  -o, --overwrite        overwrite existing files
  -r, --recursive        recursively process the specified directory
  -t, --template [STRING]renaming template (Default is {{dir}}/{{date}}_{{file}})
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
    dryrun: false,                      // simulate processing without modifying the filesystem?
    fallback_ctime: true,               // fallback to filesystem ctime if no DateTimeOriginal in EXIF?
    overwrite: false,                   // overwrite existing files?
    path_separator: '/',                // the character used to separate paths in templates
    formats: {
        datetime: 'yyyymmdd-HHMMss',    // default formatting for {{datetime}}
        date: 'yyyymmdd',               // default formatting for {{date}}
        time: 'HHMMss'                  // default formatting for {{time}}
    },
    valid_extensions: ['jpg', 'jpeg']   // supported file extensions for processing
}
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
> `{{dir}}/{{datetime}}_{{file}}`

> Prefix the filename with a custom datetime format (see [dateformat](https://www.npmjs.org/package/dateformat)):<br>
> `{{dir}}/{{datetime "yy-mm"}}_{{file}}`

> Move the image to a "YYYY-MM" directory:<br>
> `{{dir}}/{{datetime "yyyy-mm"}}/{{file}}`

> Prefix the parent directory with the date:<br>
> `{{dir}}/../{{date}} {{dirname}}/{{file}}`

> Prefix the filename with the file extension and camera model:<br>
> `{{dir}}/{{EXT}}-{{image.Model}}-{{file}}`

> Prefix the filename with the F-number:<br>
> `{{dir}}/F{{exif.FNumber}}-{{file}}`

Some things to point out:

- The library makes no assumptions about the target directory, so it must be specified in the
  template. You can use `{{dir}}` to refer to the directory of the source image, as shown in the
  examples above.
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
the exif data generated by the [exif module](https://www.npmjs.org/package/exif), path information,
and some other useful stuff:

```
{
    // EXIF data
    <see: https://www.npmjs.org/package/exif>,

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
- `callback` the node-style callback that will receive the response
- `recursive` boolean switch to enable recursive processing, defaults to false

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
- `callback` the node-style callback that will receive the response

##### usage

```javascript
exifRenamer.watch('path/to/watch/dir', 'renaming-template', function(err, result) {
    //...
});
```

## Support

This software is free and open source and maintained by just one guy who has a day job.
If you have a feature request or bug report please
[open an issue on GitHub](https://github.com/dylansmith/node-exif-renamer/issues) or
[discuss it on Gitter](https://gitter.im/dylansmith/node-exif-renamer).

## Contributing

If you are a developer please feel free to get involved and send a pull request with
your enhancements or bugfix.

## Release History
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
