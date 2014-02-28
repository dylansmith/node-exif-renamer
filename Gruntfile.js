'use strict';

module.exports = function(grunt) {

    // Project configuration.
    grunt.initConfig({

        jshint: {
            options: {
                jshintrc: '.jshintrc'
            },
            gruntfile: {
                src: 'Gruntfile.js'
            },
            demo: {
                src: ['demo/**/*.js']
            },
            lib: {
                src: ['lib/**/*.js']
            },
            test: {
                src: ['test/**/*.js']
            },
        },

        watch: {
            gruntfile: {
                files: '<%= jshint.gruntfile.src %>',
                tasks: ['jshint:gruntfile']
            },
            lib: {
                files: '<%= jshint.lib.src %>',
                tasks: ['jshint:lib', 'test']
            },
            test: {
                files: ['<%= jshint.test.src %>'],
                tasks: ['jshint:test', 'test']
            },
        },

        mocha_istanbul: {
            coverage: {
                src: 'test',
                options: {
                    mask: '*.spec.js',
                    // reporters: dot, spec, nyan, tap, landing, list, progress
                    reporter: 'spec'
                }
            }
        }
    });

    // These plugins provide necessary tasks.
    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-mocha-istanbul');

    // Tasks
    grunt.registerTask('test', ['mocha_istanbul:coverage']);
    grunt.registerTask('default', ['jshint', 'test']);

};
