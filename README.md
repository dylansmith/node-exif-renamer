# exif-renamer [![Build Status](https://secure.travis-ci.org/dylansmith/node-exif-renamer.png?branch=master)](http://travis-ci.org/dylansmith/node-exif-renamer)

A NodeJS service to rename photos using their EXIF data.

## Installation
Install the module with: `npm install exif-renamer`

## Usage
First, import the module:

```javascript
var exifRenamer = require('exif-renamer');
```

exif-renamer supports node-style callbacks:

```javascript
exifRenamer.rename('path/to/image.file', '%yyyy-%mm-%dd_%n', function(error, filename) {
    if (!error) {
        console.log('the file was renamed: ', filename);
    } else {
        console.log('an error occurred', error);
    }
});
```

It also supports promises (using the `q` library):

```javascript
exifRenamer
    .rename('path/to/image.file', '%yyyy-%mm-%dd_%n')
    .then(function(filename)) {
        console.log('the file was renamed: ', filename);
    })
    .catch(function(error) {
        console.log('an error occurred', error);
    })
    .done();
```

## Documentation
Coming soon.

## Contributing
In lieu of a formal styleguide, take care to maintain the existing coding style. Add unit tests for any new or changed functionality. Lint and test your code using [Grunt](http://gruntjs.com/).

## Release History
0.1.0 - initial version, work in progress

## License
Copyright (c) 2014 Dylan Smith
Licensed under the MIT license.
