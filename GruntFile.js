module.exports = function(grunt) {

	grunt.initConfig({
		jshint: {
			files: ["src/**/*.js"],
			options: {
				esnext: true,
				globals: {
					jQuery: true
				}
			}
		},
    obfuscator: {
        options: {
          //https://github.com/javascript-obfuscator/javascript-obfuscator#javascript-obfuscator-options
          // Medium obfuscation, optimal performance
          // Performance will 30-35% slower than without obfuscation
					compact: true,
					controlFlowFlattening: false,
					deadCodeInjection: false,
					debugProtection: false,
					debugProtectionInterval: false,
					disableConsoleOutput: true,
					mangle: true,
					rotateStringArray: true,
					selfDefending: true,
					stringArray: true,
					stringArrayEncoding: false,
					stringArrayThreshold: 0.75,
					unicodeEscapeSequence: false
        },
        task: {
          options: {
              // options for each sub task
          },
          files: [
            {
              expand: true,     // Enable dynamic expansion.
              cwd: 'src/',      // Src matches are relative to this path.
              src: ['**/*.js'], // Actual pattern(s) to match.
              dest: 'dist/'   // Destination path prefix.
            },
          ]
        }
      },
			clean: {
			  folder: ['dist/']
			},
			copy: {
				main: {
					files: [
						// makes all src relative to cwd
						{expand: true, cwd: 'src/', src: ['**/*.json','**/*.wsdl'], dest: 'dist/'}
					],
				},
			},
			uglify: {
				files: ["src/**/*.js"],
				options: {
					beautify: false, //prod
	        output: {
	          comments: false
	        },
	        mangle: {
	          screw_ie8: true
	        }, //prod
	        compress: {
	          screw_ie8: true,
	          warnings: false,
	          conditionals: true,
	          unused: true,
	          comparisons: true,
	          sequences: true,
	          dead_code: true,
	          evaluate: true,
	          if_return: true,
	          join_vars: true,
	          negate_iife: false // we need this for lazy v8
	        },
	        comments: false //prod
				}
			}
	});

	grunt.loadNpmTasks("grunt-contrib-jshint");
  grunt.loadNpmTasks('grunt-contrib-obfuscator');
	grunt.loadNpmTasks('grunt-contrib-copy');
	grunt.loadNpmTasks('grunt-contrib-clean');
	grunt.loadNpmTasks('grunt-contrib-uglify');

	grunt.registerTask("build:prod", ["clean","uglify"]);
	grunt.registerTask("qa", ["jshint"]);

  grunt.registerTask("default", ["qa"]);
};
