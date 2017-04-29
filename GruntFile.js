module.exports = function(grunt) {

	grunt.initConfig({
		jshint: {
			files: ["*.js", "client/*.js", "model/*.js", "server/*.js", "storage/*.js", "utils/*.js"],
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
			}
	});

	grunt.loadNpmTasks("grunt-contrib-jshint");
  grunt.loadNpmTasks('grunt-contrib-obfuscator');
	grunt.loadNpmTasks('grunt-contrib-copy');
	grunt.loadNpmTasks('grunt-contrib-clean');

	grunt.registerTask("obfuscate", ["clean","obfuscator"]);
	grunt.registerTask("jshint", ["jshint"]);

  grunt.registerTask("default", ["jshint","clean","obfuscator"]);
};
