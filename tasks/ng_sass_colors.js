/*
 * grunt-ng-sass-colors
 * https://github.com/amey/grunt-ng-sass-colors
 *
 * Copyright (c) 2014 Amey Sakhadeo
 * Licensed under the MIT license.
 */

'use strict';

module.exports = function(grunt) {

  // Please see the Grunt documentation for more information regarding task
  // creation: http://gruntjs.com/creating-tasks

    var rDefinedVars = /\$([\w\-]+)\s*\:\s*((?:#[A-Fa-f0-9]{3,6})|(?:rgba?\((?:\d+(?:\s*,\s*\d+){2,3})\))|(?:[A-Za-z]+))\s*;/g,
      rReferenceVars = /\$([\w\-]+)\s*\:\s*(?:\$([\w\-]+))\s*;/g,
      ngValuePrefixStr, ngValueSuffixStr, ngValueEntryStr,
      definedSymbols, forwardDeclarations, resolvedSymbols,
      buildSymbolTable, initSymbolTable, resolveForwardDeclarations,
      getColorVariableTester, normalizeName;

    ngValuePrefixStr = 'angular.module(<%=quotes%><%= module %><%=quotes%>).values' +
      '(<%=quotes%><%=providerName%><%=quotes%>, {\n';

    ngValueSuffixStr = '\n});\n';
    ngValueEntryStr = '<%= key %>: <%=quotes%><%=value%><%=quotes%>,\n';

    getColorVariableTester = function(tester) {

        if(grunt.util.kindOf(tester) === 'function') {
            return tester;
        } else if( grunt.util.kindOf(tester) === 'regexp' ){
          return function(variableName) {
            return !!tester.test(variableName);
          };
        } else {
          return function(){
            return true;
          };
        }
    };

    normalizeName = function(str){
      return str.replace(/[\-]/g, '_').toUpperCase();
    };

    initSymbolTable = function() {

      definedSymbols = {};
      forwardDeclarations = {};
      resolvedSymbols = {};
    };
    buildSymbolTable = function(text, isColorVar) {

      var matches, n, v, k;

      // First, find defined variables
      while ((matches = rDefinedVars.exec(text)) !== null ) {
          n = matches[1];
          v = matches[2];

          if(isColorVar(n)) {
            definedSymbols[n] = v;
          }
      }

      // Then try to find forward declared and references
      while ((matches = rReferenceVars.exec(text)) !== null ) {
        n = matches[1];
        v = matches[2];

        if(!isColorVar(n)) {
          continue;
        }
        if(definedSymbols[v]) {
          resolvedSymbols[n] = {
            value: definedSymbols[v],
            via: v
          };
        } else {
          forwardDeclarations[n] = {
            value: null,
            via: v
          };
        }

    }
  };

  resolveForwardDeclarations = function() {
    var k, n, v;
    for(k in forwardDeclarations) {
      if(forwardDeclarations.hasOwnProperty(k)) {
        n = forwardDeclarations[k].via;
        if(definedSymbols[n]) {
          v = definedSymbols[n];
          forwardDeclarations[k].value = v;
        }
      }
    }
  };
  grunt.registerMultiTask('ng_sass_colors', 'Converts SASS colors to angular values', function() {
    // Merge task-specific and/or target-specific options with these defaults.
    var options = this.options({
      variablesLike: null,
      module: null,
      providerName: 'ColorPalette',
      quotes: '\''
    }),
    templateStr;

    // Iterate over all specified file groups.
    this.files.forEach(function(f) {
      // Concat specified files.
      var isColorVar, k, entry;
      var src = f.src.filter(function(filepath) {
        // Warn on and remove invalid source files (if nonull was set).
        if (!grunt.file.exists(filepath)) {
          grunt.log.warn('Source file "' + filepath + '" not found.');
          return false;
        } else {
          return true;
        }
      }).map(function(filepath) {
        // Read file source.
        return grunt.file.read(filepath);
      }).join(grunt.util.normalizelf(''));


      isColorVar = getColorVariableTester(options.variablesLike);
      initSymbolTable();
      buildSymbolTable(src, isColorVar);

      resolveForwardDeclarations();

      templateStr = grunt.template.process(ngValuePrefixStr, {data:options});
      //forwardDeclarations, resolvedSymbols,
      for(k in definedSymbols) {
        entry = {
          key: normalizeName(k),
          value: definedSymbols[k],
          quotes: options.quotes
        };

        templateStr += grunt.template.process(ngValueEntryStr,{data:entry});
      }

      for(k in forwardDeclarations) {
        entry = {
          key: normalizeName(k),
          value: forwardDeclarations[k].value,
          quotes: options.quotes
        };

        templateStr += grunt.template.process(ngValueEntryStr,{data:entry});
      }

      for(k in resolvedSymbols) {
        entry = {
          key: normalizeName(k),
          value: resolvedSymbols[k].value,
          quotes: options.quotes
        };

        templateStr += grunt.template.process(ngValueEntryStr,{data:entry});
      }

      templateStr += grunt.template.process(ngValueSuffixStr, {data:options});
      // Write the destination file.
      grunt.file.write(f.dest, templateStr);

      // Print a success message.
      grunt.log.writeln('File "' + f.dest + '" created.');
    });
  });

};
