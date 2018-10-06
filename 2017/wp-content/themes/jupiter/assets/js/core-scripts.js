(function($) {// v5 namespace 
var MK = {
	api 		: {},
	ui 			: {},
	component 	: {},
};

// Global 
window.MK = MK;
// http://alistapart.com/article/container-queries-once-more-unto-the-breach
  window.elementQuery = (function() {

    // implementations for testing actual element query properties
    var queryMatchers = {
      "min-width": function(element, value, units) {
        var el = element;
        var px = convertToPx(el, value, units);
        return value && el && el.offsetWidth >= px;
      },
      "max-width": function(element, value, units) {
        var el = element;
        var px = convertToPx(el, value, units);
        return value && el && el.offsetWidth < px;
      }
    };

    // convert an element query into a css class name we can replace it with
    var classNameForRules = function(rules) {
      var name = "query";
      for (var i = 0, len = rules.length; i < len; i++) {
        name += "_" + rules[i].property + "_" + rules[i].value + rules[i].units;
      }
      return name;
    };
    
    // determine the px value for a measurement (e.g. "5em") on a given element
    var convertToPx = function(element, value, units) {
      switch (units) {
        case "px": return value;
        case "em": return value * getEmSize(element);
        case "rem": return value * getEmSize();
        // Viewport units!
        // According to http://quirksmode.org/mobile/tableViewport.html
        // documentElement.clientWidth/Height gets us the most reliable info
        case "vw": return value * document.documentElement.clientWidth / 100;
        case "vh": return value * document.documentElement.clientHeight / 100;
        case "vmin":
        case "vmax":
          var vw = document.documentElement.clientWidth / 100;
          var vh = document.documentElement.clientHeight / 100;
          var chooser = Math[units === "vmin" ? "min" : "max"];
          return value * chooser(vw, vh);
        default: return value;
        // for now, not supporting physical units (since they are just a set number of px)
        // or ex/ch (getting accurate measurements is hard)
      }
    };
    
    // determine the size of an em in a given element
    var getEmSize = function(element) {
      if (!element) {
        element = document.documentElement;
      }
      if (window.getComputedStyle) {
        return parseFloat(getComputedStyle(element).fontSize) || 16;
      }
      // TODO: support IE?
      return 16;
    };

    // test whether an element matches a set of query rules
    var elementMatchesRules = function(element, rules) {
      for (var i = rules.length - 1; i > -1; i--) {
        var rule = rules[i];
        var matcher = queryMatchers[rule.property];
        if (matcher && !matcher(element, rule.value, rule.units)) {
          return false;
        }
      }
      return true;
    };

    var loader = {
      // parse an array of CSSStyleSheet objects for element queries
      loadStyleSheets: function(sheets, callback) {
        var completed = 0;
        for (var i = 0, len = sheets.length; i < len; i++) {

          // if( (sheets[i].href && sheets[i].href.indexOf('media.min.css') != -1) || (sheets[i].href && sheets[i].href.indexOf('media.css') != -1) ) {
            this.loadStyleSheet(sheets[i], function() {
              completed += 1;
              if (completed === len) {
                callback && callback();
              }
            });
          // }
        }
      },

      // parse a single CSSStyleSheet object for element queries
      loadStyleSheet: function(sheet, callback) {
        if (sheet.ownerNode.nodeName === "STYLE" && sheet.ownerNode.id === 'js-media-query-css') {
          // if(sheet.ownerNode.id !== 'js-media-query') return;
          var result = elementQuery.parser.parseStyleText(sheet.ownerNode.innerHTML);
          sheet.ownerNode.innerHTML += result.newCss;
          elementQuery.queries = elementQuery.queries.concat(result.queries);
          callback && callback();
        }
        // else if (sheet.href) {
        // if (sheet.href && sheet.ownerNode.id === 'js-media-query-css') {
        //   var xhr = new XMLHttpRequest();
        //   xhr.open("GET", sheet.href, true);
        //   xhr.onreadystatechange = function() {
        //     if (xhr.readyState === 4) {
        //       if (xhr.status === 200) {
        //         var result = elementQuery.parser.parseStyleText(xhr.responseText);
        //         elementQuery.queries = elementQuery.queries.concat(result.queries);
        //         var style = document.createElement("style");
        //         style.innerHTML = result.newCss;
        //         document.body.appendChild(style);
        //       }
        //       else if (window.console) {
        //         console.log("Could not load stylesheet at " + sheet.href);
        //       }
        //       callback && callback();
        //     }
        //   }
        //   xhr.send(null);
        // }
      },
    };

    // public API
    var elementQuery = {
      autoInit: true,

      init: function() {
        var evaluated = false;
        this.loader.loadStyleSheets(document.styleSheets, function() {
          evaluated = true;
          elementQuery.evaluateQueries();
        });

        // if we are still waiting for some asynchronous ones, go ahead and evaluate
        // any found queries now for minimum latency
        if (!evaluated) {
          elementQuery.evaluateQueries();
        }
      },

      // update the styling for all the elements that have queries
      evaluateQueries: function(context) {
        context = context || document;
        var queries = this.queries;
        for (var i = 0, len = queries.length; i < len; i++) {
          var elements = context.querySelectorAll(queries[i].selector);
          for (var j = 0; j < elements.length; j++) {
            var element = elements[j];
            if (elementMatchesRules(element, queries[i].rules)) {
              element.classList.add(queries[i].className);
            }
            else {
              element.classList.remove(queries[i].className);
            }
          }
        }
      },

      queryMatchers: queryMatchers,
      queries: [],
      classNameForRules: classNameForRules,
      loader: loader
    };

    // re-run all queries on resize
    window.addEventListener("resize", function() {
      elementQuery.evaluateQueries();
    }, false);

    // automatically look for things on window load
    window.addEventListener("load", function() {
      if (elementQuery.autoInit) {
        elementQuery.init();
        setTimeout(function() {
          elementQuery.evaluateQueries();
        }, 1000);
      }
    });

    // TODO: re-run all queries... on an interval?
    // override setTimeout, addEventListener, etc to hit every possible JS entry
    // point? Not really an ideal solution to this.
    // Repaint events in Mozilla?
    
    return elementQuery;
    
  }());

  (function(elementQuery) {

    // Identifies comments in CSS
    var COMMENT_PATTERN = /(\/\*)[\s\S]*?(\*\/)/g;
    // $1 is the end of a block ("}")
    // $2 is all of a simple @rule ("@something ...;")
    // $3 is the start of a rule with a block, excluding the opening {
    //    this could be an @media rule or a simple style rule.
    var STATEMENT_END_OR_START_PATTERN = /\s*(?:(\})|(@\S+\s+[^;{]+;)|(?:([^{}]+)\{))/g;
    // element queries look like:
    // `:media(property: value)` or `:media((property: value) and (property: value))`
    var QUERY_PATTERN = /:media\s*\(([^)]*)\)/g;
    var QUERY_RULES_PATTERN = /\(?([^\s:]+):\s*(\d+(?:\.\d+)?)(px|em|rem|vw|vh|vmin|vmax)\)?/g;
    var WHITESPACE_PATTERN = /^\s*$/;

    // Parse CSS content for element queries
    elementQuery.parser = {
      /**
       * This the main entry point for parsing some CSS. Pass it a string of
       * CSS content and you'll get back an object like:
       *   {
       *     queries: [array of query objects]
       *     newCss: [string of new CSS]
       *   }
       * The `newCss` property contains new CSS rules to use in place of the
       * rules that have element queries -- they replace the queries in selectors
       * with classes you can turn on and off on the relevant elements. You'll 
       * want to insert the new CSS content into a <style> element on your page.
       * 
       * @param  {String} styleText The text of a style sheet
       * @return {Object}
       */
      parseStyleText: function(styleText) {
        var newText = "";
        var queries = [];

        this.parseText(styleText, {
          // TODO: don't write a media query to newText if it has no element 
          // queries. Unfortunately that means tracking nesting level :\
          mediaQuery: function(selector) {
            newText += "\n" + selector + "{";
          },

          endMediaQuery: function() {
            newText += "\n}";
          },

          rule: function(selector, properties) {
            // a selector is an array of selectors, which are arrays in the form:
            // [text, elementQuery, text, elementQuery, etc., optional text]
            // TODO: maybe have a callback for each? May simplify the logic here.
            for (var i = 0, len = selector.length; i < len; i++) {
              var single = selector[i];

              // we're going to build up a new selector in `selectorSoFar`, 
              // replacing the element queries with classes.
              var selectorSoFar = "";

              // jump by two since we are dealing with [text, query] pairs
              for (var j = 0, lenj = single.length; j < lenj; j += 2) {
                // add text content to the selector
                selectorSoFar += single[j];
                var rules = single[j + 1];
                // we may have trailing text at the end, in which case there will
                // be no associated query rules.
                if (rules) {
                  var queryClass = elementQuery.classNameForRules(rules);
                  // create and add a query object for this element query
                  queries.push({
                    selector: selectorSoFar,
                    rules: rules,
                    className: queryClass
                  });
                  // replace the query in the selector with a class
                  selectorSoFar += "." + queryClass;
                }
              }

              // Add this selector to our new CSS
              newText += selectorSoFar + (i < len - 1 ? "," : "");
            }

            // Add the actual style rule content
            newText += " {" + properties + "}";
          }
        });

        return {
          queries: queries,
          newCss: newText
        };
      },

      /**
       * Parse the text of a stylesheet. Usually, you'll want to use 
       * parseStyleText() instead; this is slightly lower-level. You should
       * provide an object with callbacks for the parsing events you are 
       * interested in:
       *   {
       *     mediaQuery: 
       *       The start of a media rule was encountered. Receives everything 
       *       from the "@" to the "{" as the first argument.
       *     endMediaQuery: 
       *       The end of a media rule was encountered. No arguments.
       *     rule: 
       *       A normal style rule was encountered. Receives the parsed selector
       *       as the first argument and the string of properties and values the
       *       rule would apply to matched elements as the second argument.
       *   }
       *
       * There is no return value for this function.
       * 
       * @param  {String} styleText The text of a stylesheet to parse.
       * @param  {Object} callbacks An object containing callbacks for the parsing
       *                            events you are interested in.
       */
      parseText: function(styleText, callbacks) {
        callbacks = callbacks || {};

        // remove comments
        var text = styleText.replace(COMMENT_PATTERN, "");
        
        // iterate through all the CSS rules
        while (match = STATEMENT_END_OR_START_PATTERN.exec(text)) {
          // we found the end of a block
          if (match[1]) {
            callbacks.endMediaQuery && callbacks.endMediaQuery();
            continue;
          }

          // if we hit a plain-jane @rule (i.e. match[2]), we don't care
          var selector = match[3];
          if (selector) {
            // Note @media rules specially, since they can contain other rules
            if (selector.slice(0, 6) === "@media") {
              callbacks.mediaQuery && callbacks.mediaQuery(selector);
            }
            // otherwise just parse the rule
            else {
              var closingIndex = text.indexOf("}", match.index);
              // don't parse other @rules with blocks, e.g. @font-face
              if (selector[0] !== "@") {
                var content = text.slice(match.index + match[0].length, closingIndex);
                this.parseRule(selector, content, callbacks.rule);
              }
              STATEMENT_END_OR_START_PATTERN.lastIndex = closingIndex + 1;
            }
          }
        }
      },
      
      /**
       * Parse a style rule. This just manages the parsing of a selector and the
       * callback for a rule.
       * @private
       * 
       * @param  {String}   selector The selector for the rule
       * @param  {String}   content  The properties and values of the rule.
       * @param  {Function} callback The callback for a parsed rule.
       */
      parseRule: function(selector, content, callback) {
        var parsedSelector = this.parseSelector(selector);
        if (parsedSelector) {
          callback && callback(parsedSelector, content);
        }
      },

      /**
       * Parse a selector string and return an array of parsed selectors (one for
       * each comma-separated sub-selector).
       * Individual sub-selectors are parsed as arrays of alternating text and
       * element queries, so this selector:
       *   body:media(...) div:media(...) a, body:media(...), a
       * returns:
       *   [["body", [rules], " div", [rules], " a"],
       *    ["body", [rules], " a"]]
       * @private
       * 
       * @param  {String} selector The selector to parse.
       * @return {Array}
       */
      parseSelector: function(selector) {
        var parsed = [];
        var parts = selector.split(",");
        for (var i = 0, len = parts.length; i < len; i++) {
          var result = this.parseSingleSelector(parts[i]);
          if (result.length > 1) {
            parsed.push(result);
          }
        }
        // return null if no selectors had element queries
        return parsed.length ? parsed : null;
      },
      
      /**
       * Parses a single sub-selector. This is used by parseSelector().
       * @private
       * @param  {String} selector The sub-selector to parse
       * @return {Array}           The parsed selector
       */
      parseSingleSelector: function(selector) {
        var parsed = [];
        var lastIndex = 0;
        while (queryMatch = QUERY_PATTERN.exec(selector)) {
          // get everything up to the element query
          var selectorChunk = selector.slice(lastIndex, queryMatch.index);
          lastIndex = QUERY_PATTERN.lastIndex;
          var queryData = this.parseQuery(queryMatch[1]);
          parsed.push(selectorChunk);
          parsed.push(queryData);
        }
        // get any remaining text in the selector
        var remaining = selector.slice(lastIndex);
        if (!WHITESPACE_PATTERN.test(remaining)) {
          parsed.push(remaining);
        }

        // reset QUERY_PATTERN
        QUERY_PATTERN.lastIndex = 0;

        return parsed;
      },

      /**
       * Parse an element query. Returns an array of objects like:
       *   {
       *     property: the property being queries, e.g. "max-available-width"
       *     value:    the actual value to test for as a number
       *     units:    the units the value is expressed in
       *   }
       *   
       * @param  {String} queryString The text of the element query.
       * @return {Array}
       */
      parseQuery: function(queryString) {
        var rules = [];
        var ruleMatch;
        while (ruleMatch = QUERY_RULES_PATTERN.exec(queryString)) {
          rules.push({
            property: ruleMatch[1],
            value: parseFloat(ruleMatch[2]),
            units: ruleMatch[3]
          });
        }
        return rules;
      }
    };

  }(elementQuery));
(function($) {
	'use strict';

	$.exists = function(selector) {
	    return ($(selector).length > 0);
	};

	/**
	 * Helper to enable caching async scripts
	 * https://api.jquery.com/jquery.getscript/
	 * http://www.vrdmn.com/2013/07/overriding-jquerygetscript-to-include.html
	 * 
	 * @param  {String}   script url
	 * @param  {Function} callback     
	 */
	$.getCachedScript = function( url ) {
		var options = {
			dataType: "script",
			cache: true,
			url: url
		};
	 
	    // Use $.ajax() since it is more flexible than $.getScript
	    // Return the jqXHR object so we can chain callbacks
	  	return $.ajax( options );
	};



	// Fn to allow an event to fire after all images are loaded
	// usage:
	// $.ajax({
	//     cache: false,
	//     url: 'ajax/content.php',
	//     success: function(data) {
	//         $('#divajax').html(data).imagesLoaded().then(function(){
	//             // do stuff after images are loaded here
	//         });
	//     }
	// });
	$.fn.mk_imagesLoaded = function () {

	    // Edit: in strict mode, the var keyword is needed
	    var $imgs = this.find('img[src!=""]');
	    // if there's no images, just return an already resolved promise
	    if (!$imgs.length) {return $.Deferred().resolve().promise();}

	    // for each image, add a deferred object to the array which resolves when the image is loaded (or if loading fails)
	    var dfds = [];  
	    $imgs.each(function(){
	        var dfd = $.Deferred();
	        dfds.push(dfd);
	        var img = new Image();
	        img.onload = function(){dfd.resolve();};
	        img.onerror = function(){dfd.resolve();};
	        img.src = this.src;
	    });

	    // return a master promise object which will resolve when all the deferred objects have resolved
	    // IE - when all the images are loaded
	    return $.when.apply($,dfds);

	};

}(jQuery));
/**
* Detect Element Resize
*
* https://github.com/sdecima/javascript-detect-element-resize
* Sebastian Decima
*
* version: 0.5.3
**/

(function () {
	var attachEvent = document.attachEvent,
		stylesCreated = false;
	
	if (!attachEvent) {
		var requestFrame = (function(){
			var raf = window.requestAnimationFrame || window.mozRequestAnimationFrame || window.webkitRequestAnimationFrame ||
								function(fn){ return window.setTimeout(fn, 20); };
			return function(fn){ return raf(fn); };
		})();
		
		var cancelFrame = (function(){
			var cancel = window.cancelAnimationFrame || window.mozCancelAnimationFrame || window.webkitCancelAnimationFrame ||
								   window.clearTimeout;
		  return function(id){ return cancel(id); };
		})();

		function resetTriggers(element){
			var triggers = element.__resizeTriggers__,
				expand = triggers.firstElementChild,
				contract = triggers.lastElementChild,
				expandChild = expand.firstElementChild;
			contract.scrollLeft = contract.scrollWidth;
			contract.scrollTop = contract.scrollHeight;
			expandChild.style.width = expand.offsetWidth + 1 + 'px';
			expandChild.style.height = expand.offsetHeight + 1 + 'px';
			expand.scrollLeft = expand.scrollWidth;
			expand.scrollTop = expand.scrollHeight;
		};

		function checkTriggers(element){
			return element.offsetWidth != element.__resizeLast__.width ||
						 element.offsetHeight != element.__resizeLast__.height;
		}
		
		function scrollListener(e){
			var element = this;
			resetTriggers(this);
			if (this.__resizeRAF__) cancelFrame(this.__resizeRAF__);
			this.__resizeRAF__ = requestFrame(function(){
				if (checkTriggers(element)) {
					element.__resizeLast__.width = element.offsetWidth;
					element.__resizeLast__.height = element.offsetHeight;
					element.__resizeListeners__.forEach(function(fn){
						fn.call(element, e);
					});
				}
			});
		};
		
		/* Detect CSS Animations support to detect element display/re-attach */
		var animation = false,
			animationstring = 'animation',
			keyframeprefix = '',
			animationstartevent = 'animationstart',
			domPrefixes = 'Webkit Moz O ms'.split(' '),
			startEvents = 'webkitAnimationStart animationstart oAnimationStart MSAnimationStart'.split(' '),
			pfx  = '';
		{
			var elm = document.createElement('fakeelement');
			if( elm.style.animationName !== undefined ) { animation = true; }    
			
			if( animation === false ) {
				for( var i = 0; i < domPrefixes.length; i++ ) {
					if( elm.style[ domPrefixes[i] + 'AnimationName' ] !== undefined ) {
						pfx = domPrefixes[ i ];
						animationstring = pfx + 'Animation';
						keyframeprefix = '-' + pfx.toLowerCase() + '-';
						animationstartevent = startEvents[ i ];
						animation = true;
						break;
					}
				}
			}
		}
		
		var animationName = 'resizeanim';
		var animationKeyframes = '@' + keyframeprefix + 'keyframes ' + animationName + ' { from { opacity: 0; } to { opacity: 0; } } ';
		var animationStyle = keyframeprefix + 'animation: 1ms ' + animationName + '; ';
	}
	
	function createStyles() {
		if (!stylesCreated) {
			//opacity:0 works around a chrome bug https://code.google.com/p/chromium/issues/detail?id=286360
			var css = (animationKeyframes ? animationKeyframes : '') +
					'.resize-triggers { ' + (animationStyle ? animationStyle : '') + 'visibility: hidden; opacity: 0; } ' +
					'.resize-triggers, .resize-triggers > div, .contract-trigger:before { content: \" \"; display: block; position: absolute; top: 0; left: 0; height: 100%; width: 100%; overflow: hidden; } .resize-triggers > div { background: #eee; overflow: auto; } .contract-trigger:before { width: 200%; height: 200%; }',
				head = document.head || document.getElementsByTagName('head')[0],
				style = document.createElement('style');
			
			style.type = 'text/css';
			if (style.styleSheet) {
				style.styleSheet.cssText = css;
			} else {
				style.appendChild(document.createTextNode(css));
			}

			head.appendChild(style);
			stylesCreated = true;
		}
	}
	
	window.addResizeListener = function(element, fn){
		if (attachEvent) element.attachEvent('onresize', fn);
		else {
			if (!element.__resizeTriggers__) {
				if (getComputedStyle(element).position == 'static') element.style.position = 'relative';
				createStyles();
				element.__resizeLast__ = {};
				element.__resizeListeners__ = [];
				(element.__resizeTriggers__ = document.createElement('div')).className = 'resize-triggers';
				element.__resizeTriggers__.innerHTML = '<div class="expand-trigger"><div></div></div>' +
																						'<div class="contract-trigger"></div>';
				element.appendChild(element.__resizeTriggers__);
				resetTriggers(element);
				element.addEventListener('scroll', scrollListener, true);
				
				/* Listen for a css animation to detect element display/re-attach */
				animationstartevent && element.__resizeTriggers__.addEventListener(animationstartevent, function(e) {
					if(e.animationName == animationName)
						resetTriggers(element);
				});
			}
			element.__resizeListeners__.push(fn);
		}
	};
	
	window.removeResizeListener = function(element, fn){
		if (attachEvent) element.detachEvent('onresize', fn);
		else {
			element.__resizeListeners__.splice(element.__resizeListeners__.indexOf(fn), 1);
			if (!element.__resizeListeners__.length) {
					element.removeEventListener('scroll', scrollListener);
					element.__resizeTriggers__ = !element.removeChild(element.__resizeTriggers__);
			}
		}
	}
})();
/**
* @preserve HTML5 Shiv 3.7.3 | @afarkas @jdalton @jon_neal @rem | MIT/GPL2 Licensed
*/
;(function(window, document) {
/*jshint evil:true */
  /** version */
  var version = '3.7.3';

  /** Preset options */
  var options = window.html5 || {};

  /** Used to skip problem elements */
  var reSkip = /^<|^(?:button|map|select|textarea|object|iframe|option|optgroup)$/i;

  /** Not all elements can be cloned in IE **/
  var saveClones = /^(?:a|b|code|div|fieldset|h1|h2|h3|h4|h5|h6|i|label|li|ol|p|q|span|strong|style|table|tbody|td|th|tr|ul)$/i;

  /** Detect whether the browser supports default html5 styles */
  var supportsHtml5Styles;

  /** Name of the expando, to work with multiple documents or to re-shiv one document */
  var expando = '_html5shiv';

  /** The id for the the documents expando */
  var expanID = 0;

  /** Cached data for each document */
  var expandoData = {};

  /** Detect whether the browser supports unknown elements */
  var supportsUnknownElements;

  (function() {
    try {
        var a = document.createElement('a');
        a.innerHTML = '<xyz></xyz>';
        //if the hidden property is implemented we can assume, that the browser supports basic HTML5 Styles
        supportsHtml5Styles = ('hidden' in a);

        supportsUnknownElements = a.childNodes.length == 1 || (function() {
          // assign a false positive if unable to shiv
          (document.createElement)('a');
          var frag = document.createDocumentFragment();
          return (
            typeof frag.cloneNode == 'undefined' ||
            typeof frag.createDocumentFragment == 'undefined' ||
            typeof frag.createElement == 'undefined'
          );
        }());
    } catch(e) {
      // assign a false positive if detection fails => unable to shiv
      supportsHtml5Styles = true;
      supportsUnknownElements = true;
    }

  }());

  /*--------------------------------------------------------------------------*/

  /**
   * Creates a style sheet with the given CSS text and adds it to the document.
   * @private
   * @param {Document} ownerDocument The document.
   * @param {String} cssText The CSS text.
   * @returns {StyleSheet} The style element.
   */
  function addStyleSheet(ownerDocument, cssText) {
    var p = ownerDocument.createElement('p'),
        parent = ownerDocument.getElementsByTagName('head')[0] || ownerDocument.documentElement;

    p.innerHTML = 'x<style>' + cssText + '</style>';
    return parent.insertBefore(p.lastChild, parent.firstChild);
  }

  /**
   * Returns the value of `html5.elements` as an array.
   * @private
   * @returns {Array} An array of shived element node names.
   */
  function getElements() {
    var elements = html5.elements;
    return typeof elements == 'string' ? elements.split(' ') : elements;
  }

  /**
   * Extends the built-in list of html5 elements
   * @memberOf html5
   * @param {String|Array} newElements whitespace separated list or array of new element names to shiv
   * @param {Document} ownerDocument The context document.
   */
  function addElements(newElements, ownerDocument) {
    var elements = html5.elements;
    if(typeof elements != 'string'){
      elements = elements.join(' ');
    }
    if(typeof newElements != 'string'){
      newElements = newElements.join(' ');
    }
    html5.elements = elements +' '+ newElements;
    shivDocument(ownerDocument);
  }

   /**
   * Returns the data associated to the given document
   * @private
   * @param {Document} ownerDocument The document.
   * @returns {Object} An object of data.
   */
  function getExpandoData(ownerDocument) {
    var data = expandoData[ownerDocument[expando]];
    if (!data) {
        data = {};
        expanID++;
        ownerDocument[expando] = expanID;
        expandoData[expanID] = data;
    }
    return data;
  }

  /**
   * returns a shived element for the given nodeName and document
   * @memberOf html5
   * @param {String} nodeName name of the element
   * @param {Document|DocumentFragment} ownerDocument The context document.
   * @returns {Object} The shived element.
   */
  function createElement(nodeName, ownerDocument, data){
    if (!ownerDocument) {
        ownerDocument = document;
    }
    if(supportsUnknownElements){
        return ownerDocument.createElement(nodeName);
    }
    if (!data) {
        data = getExpandoData(ownerDocument);
    }
    var node;

    if (data.cache[nodeName]) {
        node = data.cache[nodeName].cloneNode();
    } else if (saveClones.test(nodeName)) {
        node = (data.cache[nodeName] = data.createElem(nodeName)).cloneNode();
    } else {
        node = data.createElem(nodeName);
    }

    // Avoid adding some elements to fragments in IE < 9 because
    // * Attributes like `name` or `type` cannot be set/changed once an element
    //   is inserted into a document/fragment
    // * Link elements with `src` attributes that are inaccessible, as with
    //   a 403 response, will cause the tab/window to crash
    // * Script elements appended to fragments will execute when their `src`
    //   or `text` property is set
    return node.canHaveChildren && !reSkip.test(nodeName) && !node.tagUrn ? data.frag.appendChild(node) : node;
  }

  /**
   * returns a shived DocumentFragment for the given document
   * @memberOf html5
   * @param {Document} ownerDocument The context document.
   * @returns {Object} The shived DocumentFragment.
   */
  function createDocumentFragment(ownerDocument, data){
    if (!ownerDocument) {
        ownerDocument = document;
    }
    if(supportsUnknownElements){
        return ownerDocument.createDocumentFragment();
    }
    data = data || getExpandoData(ownerDocument);
    var clone = data.frag.cloneNode(),
        i = 0,
        elems = getElements(),
        l = elems.length;
    for(;i<l;i++){
        clone.createElement(elems[i]);
    }
    return clone;
  }

  /**
   * Shivs the `createElement` and `createDocumentFragment` methods of the document.
   * @private
   * @param {Document|DocumentFragment} ownerDocument The document.
   * @param {Object} data of the document.
   */
  function shivMethods(ownerDocument, data) {
    if (!data.cache) {
        data.cache = {};
        data.createElem = ownerDocument.createElement;
        data.createFrag = ownerDocument.createDocumentFragment;
        data.frag = data.createFrag();
    }


    ownerDocument.createElement = function(nodeName) {
      //abort shiv
      if (!html5.shivMethods) {
          return data.createElem(nodeName);
      }
      return createElement(nodeName, ownerDocument, data);
    };

    ownerDocument.createDocumentFragment = Function('h,f', 'return function(){' +
      'var n=f.cloneNode(),c=n.createElement;' +
      'h.shivMethods&&(' +
        // unroll the `createElement` calls
        getElements().join().replace(/[\w\-:]+/g, function(nodeName) {
          data.createElem(nodeName);
          data.frag.createElement(nodeName);
          return 'c("' + nodeName + '")';
        }) +
      ');return n}'
    )(html5, data.frag);
  }

  /*--------------------------------------------------------------------------*/

  /**
   * Shivs the given document.
   * @memberOf html5
   * @param {Document} ownerDocument The document to shiv.
   * @returns {Document} The shived document.
   */
  function shivDocument(ownerDocument) {
    if (!ownerDocument) {
        ownerDocument = document;
    }
    var data = getExpandoData(ownerDocument);

    if (html5.shivCSS && !supportsHtml5Styles && !data.hasCSS) {
      data.hasCSS = !!addStyleSheet(ownerDocument,
        // corrects block display not defined in IE6/7/8/9
        'article,aside,dialog,figcaption,figure,footer,header,hgroup,main,nav,section{display:block}' +
        // adds styling not present in IE6/7/8/9
        'mark{background:#FF0;color:#000}' +
        // hides non-rendered elements
        'template{display:none}'
      );
    }
    if (!supportsUnknownElements) {
      shivMethods(ownerDocument, data);
    }
    return ownerDocument;
  }

  /*--------------------------------------------------------------------------*/

  /**
   * The `html5` object is exposed so that more elements can be shived and
   * existing shiving can be detected on iframes.
   * @type Object
   * @example
   *
   * // options can be changed before the script is included
   * html5 = { 'elements': 'mark section', 'shivCSS': false, 'shivMethods': false };
   */
  var html5 = {

    /**
     * An array or space separated string of node names of the elements to shiv.
     * @memberOf html5
     * @type Array|String
     */
    'elements': options.elements || 'abbr article aside audio bdi canvas data datalist details dialog figcaption figure footer header hgroup main mark meter nav output picture progress section summary template time video',

    /**
     * current version of html5shiv
     */
    'version': version,

    /**
     * A flag to indicate that the HTML5 style sheet should be inserted.
     * @memberOf html5
     * @type Boolean
     */
    'shivCSS': (options.shivCSS !== false),

    /**
     * Is equal to true if a browser supports creating unknown/HTML5 elements
     * @memberOf html5
     * @type boolean
     */
    'supportsUnknownElements': supportsUnknownElements,

    /**
     * A flag to indicate that the document's `createElement` and `createDocumentFragment`
     * methods should be overwritten.
     * @memberOf html5
     * @type Boolean
     */
    'shivMethods': (options.shivMethods !== false),

    /**
     * A string to describe the type of `html5` object ("default" or "default print").
     * @memberOf html5
     * @type String
     */
    'type': 'default',

    // shivs the document according to the specified `html5` object options
    'shivDocument': shivDocument,

    //creates a shived element
    createElement: createElement,

    //creates a shived documentFragment
    createDocumentFragment: createDocumentFragment,

    //extends list of elements
    addElements: addElements
  };

  /*--------------------------------------------------------------------------*/

  // expose html5
  window.html5 = html5;

  // shiv the document
  shivDocument(document);

  if(typeof module == 'object' && module.exports){
    module.exports = html5;
  }

}(typeof window !== "undefined" ? window : this, document));
/*! matchMedia() polyfill - Test a CSS media type/query in JS. Authors & copyright (c) 2012: Scott Jehl, Paul Irish, Nicholas Zakas, David Knight. Dual MIT/BSD license */

window.matchMedia || (window.matchMedia = function() {
    "use strict";

    // For browsers that support matchMedium api such as IE 9 and webkit
    var styleMedia = (window.styleMedia || window.media);

    // For those that don't support matchMedium
    if (!styleMedia) {
        var style       = document.createElement('style'),
            script      = document.getElementsByTagName('script')[0],
            info        = null;

        style.type  = 'text/css';
        style.id    = 'matchmediajs-test';

        script.parentNode.insertBefore(style, script);

        // 'style.currentStyle' is used by IE <= 8 and 'window.getComputedStyle' for all other browsers
        info = ('getComputedStyle' in window) && window.getComputedStyle(style, null) || style.currentStyle;

        styleMedia = {
            matchMedium: function(media) {
                var text = '@media ' + media + '{ #matchmediajs-test { width: 1px; } }';

                // 'style.styleSheet' is used by IE <= 8 and 'style.textContent' for all other browsers
                if (style.styleSheet) {
                    style.styleSheet.cssText = text;
                } else {
                    style.textContent = text;
                }

                // Test if media query is true or false
                return info.width === '1px';
            }
        };
    }

    return function(media) {
        return {
            matches: styleMedia.matchMedium(media || 'all'),
            media: media || 'all'
        };
    };
}());

/*!
 * The MIT License
 *
 * Copyright (c) 2012 James Allardice
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to
 * deal in the Software without restriction, including without limitation the
 * rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
 * sell copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
 * IN THE SOFTWARE.
 */

( function ( global ) {

  'use strict';

  //
  // Test for support. We do this as early as possible to optimise for browsers
  // that have native support for the attribute.
  //

  var test = document.createElement('input');
  var nativeSupport = test.placeholder !== void 0;

  global.Placeholders = {
    nativeSupport: nativeSupport,
    disable: nativeSupport ? noop : disablePlaceholders,
    enable: nativeSupport ? noop : enablePlaceholders
  };

  if ( nativeSupport ) {
    return;
  }

  //
  // If we reach this point then the browser does not have native support for
  // the attribute.
  //

  // The list of input element types that support the placeholder attribute.
  var validTypes = [
    'text',
    'search',
    'url',
    'tel',
    'email',
    'password',
    'number',
    'textarea'
  ];

  // The list of keycodes that are not allowed when the polyfill is configured
  // to hide-on-input.
  var badKeys = [

    // The following keys all cause the caret to jump to the end of the input
    // value.

    27, // Escape
    33, // Page up
    34, // Page down
    35, // End
    36, // Home

    // Arrow keys allow you to move the caret manually, which should be
    // prevented when the placeholder is visible.

    37, // Left
    38, // Up
    39, // Right
    40, // Down

    // The following keys allow you to modify the placeholder text by removing
    // characters, which should be prevented when the placeholder is visible.

    8, // Backspace
    46 // Delete
  ];

  // Styling variables.
  var placeholderStyleColor = '#ccc';
  var placeholderClassName = 'placeholdersjs';
  var classNameRegExp = new RegExp('(?:^|\\s)' + placeholderClassName + '(?!\\S)');

  // The various data-* attributes used by the polyfill.
  var ATTR_CURRENT_VAL = 'data-placeholder-value';
  var ATTR_ACTIVE = 'data-placeholder-active';
  var ATTR_INPUT_TYPE = 'data-placeholder-type';
  var ATTR_FORM_HANDLED = 'data-placeholder-submit';
  var ATTR_EVENTS_BOUND = 'data-placeholder-bound';
  var ATTR_OPTION_FOCUS = 'data-placeholder-focus';
  var ATTR_OPTION_LIVE = 'data-placeholder-live';
  var ATTR_MAXLENGTH = 'data-placeholder-maxlength';

  // Various other variables used throughout the rest of the script.
  var UPDATE_INTERVAL = 100;
  var head = document.getElementsByTagName('head')[ 0 ];
  var root = document.documentElement;
  var Placeholders = global.Placeholders;
  var keydownVal;

  // Get references to all the input and textarea elements currently in the DOM
  // (live NodeList objects to we only need to do this once).
  var inputs = document.getElementsByTagName('input');
  var textareas = document.getElementsByTagName('textarea');

  // Get any settings declared as data-* attributes on the root element.
  // Currently the only options are whether to hide the placeholder on focus
  // or input and whether to auto-update.
  var hideOnInput = root.getAttribute(ATTR_OPTION_FOCUS) === 'false';
  var liveUpdates = root.getAttribute(ATTR_OPTION_LIVE) !== 'false';

  // Create style element for placeholder styles (instead of directly setting
  // style properties on elements - allows for better flexibility alongside
  // user-defined styles).
  var styleElem = document.createElement('style');
  styleElem.type = 'text/css';

  // Create style rules as text node.
  var styleRules = document.createTextNode(
    '.' + placeholderClassName + ' {' +
      'color:' + placeholderStyleColor + ';' +
    '}'
  );

  // Append style rules to newly created stylesheet.
  if ( styleElem.styleSheet ) {
    styleElem.styleSheet.cssText = styleRules.nodeValue;
  } else {
    styleElem.appendChild(styleRules);
  }

  // Prepend new style element to the head (before any existing stylesheets,
  // so user-defined rules take precedence).
  head.insertBefore(styleElem, head.firstChild);

  // Set up the placeholders.
  var placeholder;
  var elem;

  for ( var i = 0, len = inputs.length + textareas.length; i < len; i++ ) {

    // Find the next element. If we've already done all the inputs we move on
    // to the textareas.
    elem = i < inputs.length ? inputs[ i ] : textareas[ i - inputs.length ];

    // Get the value of the placeholder attribute, if any. IE10 emulating IE7
    // fails with getAttribute, hence the use of the attributes node.
    placeholder = elem.attributes.placeholder;

    // If the element has a placeholder attribute we need to modify it.
    if ( placeholder ) {

      // IE returns an empty object instead of undefined if the attribute is
      // not present.
      placeholder = placeholder.nodeValue;

      // Only apply the polyfill if this element is of a type that supports
      // placeholders and has a placeholder attribute with a non-empty value.
      if ( placeholder && inArray(validTypes, elem.type) ) {
        newElement(elem);
      }
    }
  }

  // If enabled, the polyfill will repeatedly check for changed/added elements
  // and apply to those as well.
  var timer = setInterval(function () {
    for ( var i = 0, len = inputs.length + textareas.length; i < len; i++ ) {
      elem = i < inputs.length ? inputs[ i ] : textareas[ i - inputs.length ];

      // Only apply the polyfill if this element is of a type that supports
      // placeholders, and has a placeholder attribute with a non-empty value.
      placeholder = elem.attributes.placeholder;

      if ( placeholder ) {

        placeholder = placeholder.nodeValue;

        if ( placeholder && inArray(validTypes, elem.type) ) {

          // If the element hasn't had event handlers bound to it then add
          // them.
          if ( !elem.getAttribute(ATTR_EVENTS_BOUND) ) {
            newElement(elem);
          }

          // If the placeholder value has changed or not been initialised yet
          // we need to update the display.
          if (
            placeholder !== elem.getAttribute(ATTR_CURRENT_VAL) ||
            ( elem.type === 'password' && !elem.getAttribute(ATTR_INPUT_TYPE) )
          ) {

            // Attempt to change the type of password inputs (fails in IE < 9).
            if (
              elem.type === 'password' &&
              !elem.getAttribute(ATTR_INPUT_TYPE) &&
              changeType(elem, 'text')
            ) {
              elem.setAttribute(ATTR_INPUT_TYPE, 'password');
            }

            // If the placeholder value has changed and the placeholder is
            // currently on display we need to change it.
            if ( elem.value === elem.getAttribute(ATTR_CURRENT_VAL) ) {
              elem.value = placeholder;
            }

            // Keep a reference to the current placeholder value in case it
            // changes via another script.
            elem.setAttribute(ATTR_CURRENT_VAL, placeholder);
          }
        }
      } else if ( elem.getAttribute(ATTR_ACTIVE) ) {
        hidePlaceholder(elem);
        elem.removeAttribute(ATTR_CURRENT_VAL);
      }
    }

    // If live updates are not enabled cancel the timer.
    if ( !liveUpdates ) {
      clearInterval(timer);
    }
  }, UPDATE_INTERVAL);

  // Disabling placeholders before unloading the page prevents flash of
  // unstyled placeholders on load if the page was refreshed.
  addEventListener(global, 'beforeunload', function () {
    Placeholders.disable();
  });

  //
  // Utility functions
  //

  // No-op (used in place of public methods when native support is detected).
  function noop() {}

  // Avoid IE9 activeElement of death when an iframe is used.
  //
  // More info:
  //  - http://bugs.jquery.com/ticket/13393
  //  - https://github.com/jquery/jquery/commit/85fc5878b3c6af73f42d61eedf73013e7faae408
  function safeActiveElement() {
    try {
      return document.activeElement;
    } catch ( err ) {}
  }

  // Check whether an item is in an array. We don't use Array.prototype.indexOf
  // so we don't clobber any existing polyfills. This is a really simple
  // alternative.
  function inArray( arr, item ) {
    for ( var i = 0, len = arr.length; i < len; i++ ) {
      if ( arr[ i ] === item ) {
        return true;
      }
    }
    return false;
  }

  // Cross-browser DOM event binding
  function addEventListener( elem, event, fn ) {
    if ( elem.addEventListener ) {
      return elem.addEventListener(event, fn, false);
    }
    if ( elem.attachEvent ) {
      return elem.attachEvent('on' + event, fn);
    }
  }

  // Move the caret to the index position specified. Assumes that the element
  // has focus.
  function moveCaret( elem, index ) {
    var range;
    if ( elem.createTextRange ) {
      range = elem.createTextRange();
      range.move('character', index);
      range.select();
    } else if ( elem.selectionStart ) {
      elem.focus();
      elem.setSelectionRange(index, index);
    }
  }

  // Attempt to change the type property of an input element.
  function changeType( elem, type ) {
    try {
      elem.type = type;
      return true;
    } catch ( e ) {
      // You can't change input type in IE8 and below.
      return false;
    }
  }

  function handleElem( node, callback ) {

    // Check if the passed in node is an input/textarea (in which case it can't
    // have any affected descendants).
    if ( node && node.getAttribute(ATTR_CURRENT_VAL) ) {
      callback(node);
    } else {

      // If an element was passed in, get all affected descendants. Otherwise,
      // get all affected elements in document.
      var handleInputs = node ? node.getElementsByTagName('input') : inputs;
      var handleTextareas = node ? node.getElementsByTagName('textarea') : textareas;

      var handleInputsLength = handleInputs ? handleInputs.length : 0;
      var handleTextareasLength = handleTextareas ? handleTextareas.length : 0;

      // Run the callback for each element.
      var len = handleInputsLength + handleTextareasLength;
      var elem;
      for ( var i = 0; i < len; i++ ) {

        elem = i < handleInputsLength ?
          handleInputs[ i ] :
          handleTextareas[ i - handleInputsLength ];

        callback(elem);
      }
    }
  }

  // Return all affected elements to their normal state (remove placeholder
  // value if present).
  function disablePlaceholders( node ) {
    handleElem(node, hidePlaceholder);
  }

  // Show the placeholder value on all appropriate elements.
  function enablePlaceholders( node ) {
    handleElem(node, showPlaceholder);
  }

  // Hide the placeholder value on a single element. Returns true if the
  // placeholder was hidden and false if it was not (because it wasn't visible
  // in the first place).
  function hidePlaceholder( elem, keydownValue ) {

    var valueChanged = !!keydownValue && elem.value !== keydownValue;
    var isPlaceholderValue = elem.value === elem.getAttribute(ATTR_CURRENT_VAL);

    if (
      ( valueChanged || isPlaceholderValue ) &&
      elem.getAttribute(ATTR_ACTIVE) === 'true'
    ) {

      elem.removeAttribute(ATTR_ACTIVE);
      elem.value = elem.value.replace(elem.getAttribute(ATTR_CURRENT_VAL), '');
      elem.className = elem.className.replace(classNameRegExp, '');

      // Restore the maxlength value. Old FF returns -1 if attribute not set.
      // See GH-56.
      var maxLength = elem.getAttribute(ATTR_MAXLENGTH);
      if ( parseInt(maxLength, 10) >= 0 ) {
        elem.setAttribute('maxLength', maxLength);
        elem.removeAttribute(ATTR_MAXLENGTH);
      }

      // If the polyfill has changed the type of the element we need to change
      // it back.
      var type = elem.getAttribute(ATTR_INPUT_TYPE);
      if ( type ) {
        elem.type = type;
      }

      return true;
    }

    return false;
  }

  // Show the placeholder value on a single element. Returns true if the
  // placeholder was shown and false if it was not (because it was already
  // visible).
  function showPlaceholder( elem ) {

    var val = elem.getAttribute(ATTR_CURRENT_VAL);

    if ( elem.value === '' && val ) {

      elem.setAttribute(ATTR_ACTIVE, 'true');
      elem.value = val;
      elem.className += ' ' + placeholderClassName;

      // Store and remove the maxlength value.
      var maxLength = elem.getAttribute(ATTR_MAXLENGTH);
      if ( !maxLength ) {
        elem.setAttribute(ATTR_MAXLENGTH, elem.maxLength);
        elem.removeAttribute('maxLength');
      }

      // If the type of element needs to change, change it (e.g. password
      // inputs).
      var type = elem.getAttribute(ATTR_INPUT_TYPE);
      if ( type ) {
        elem.type = 'text';
      } else if ( elem.type === 'password' && changeType(elem, 'text') ) {
        elem.setAttribute(ATTR_INPUT_TYPE, 'password');
      }

      return true;
    }

    return false;
  }

  // Returns a function that is used as a focus event handler.
  function makeFocusHandler( elem ) {
    return function () {

      // Only hide the placeholder value if the (default) hide-on-focus
      // behaviour is enabled.
      if (
        hideOnInput &&
        elem.value === elem.getAttribute(ATTR_CURRENT_VAL) &&
        elem.getAttribute(ATTR_ACTIVE) === 'true'
      ) {

        // Move the caret to the start of the input (this mimics the behaviour
        // of all browsers that do not hide the placeholder on focus).
        moveCaret(elem, 0);
      } else {

        // Remove the placeholder.
        hidePlaceholder(elem);
      }
    };
  }

  // Returns a function that is used as a blur event handler.
  function makeBlurHandler( elem ) {
    return function () {
      showPlaceholder(elem);
    };
  }

  // Returns a function that is used as a submit event handler on form elements
  // that have children affected by this polyfill.
  function makeSubmitHandler( form ) {
    return function () {

        // Turn off placeholders on all appropriate descendant elements.
        disablePlaceholders(form);
    };
  }

  // Functions that are used as a event handlers when the hide-on-input
  // behaviour has been activated - very basic implementation of the 'input'
  // event.
  function makeKeydownHandler( elem ) {
    return function ( e ) {
      keydownVal = elem.value;

      // Prevent the use of the arrow keys (try to keep the cursor before the
      // placeholder).
      if (
        elem.getAttribute(ATTR_ACTIVE) === 'true' &&
        keydownVal === elem.getAttribute(ATTR_CURRENT_VAL) &&
        inArray(badKeys, e.keyCode)
      ) {
        if ( e.preventDefault ) {
            e.preventDefault();
        }
        return false;
      }
    };
  }

  function makeKeyupHandler(elem) {
    return function () {
      hidePlaceholder(elem, keydownVal);

      // If the element is now empty we need to show the placeholder
      if ( elem.value === '' ) {
        elem.blur();
        moveCaret(elem, 0);
      }
    };
  }

  function makeClickHandler(elem) {
    return function () {
      if (
        elem === safeActiveElement() &&
        elem.value === elem.getAttribute(ATTR_CURRENT_VAL) &&
        elem.getAttribute(ATTR_ACTIVE) === 'true'
      ) {
        moveCaret(elem, 0);
      }
    };
  }

  // Bind event handlers to an element that we need to affect with the
  // polyfill.
  function newElement( elem ) {

    // If the element is part of a form, make sure the placeholder string is
    // not submitted as a value.
    var form = elem.form;
    if ( form && typeof form === 'string' ) {

      // Get the real form.
      form = document.getElementById(form);

      // Set a flag on the form so we know it's been handled (forms can contain
      // multiple inputs).
      if ( !form.getAttribute(ATTR_FORM_HANDLED) ) {
        addEventListener(form, 'submit', makeSubmitHandler(form));
        form.setAttribute(ATTR_FORM_HANDLED, 'true');
      }
    }

    // Bind event handlers to the element so we can hide/show the placeholder
    // as appropriate.
    addEventListener(elem, 'focus', makeFocusHandler(elem));
    addEventListener(elem, 'blur', makeBlurHandler(elem));

    // If the placeholder should hide on input rather than on focus we need
    // additional event handlers
    if (hideOnInput) {
      addEventListener(elem, 'keydown', makeKeydownHandler(elem));
      addEventListener(elem, 'keyup', makeKeyupHandler(elem));
      addEventListener(elem, 'click', makeClickHandler(elem));
    }

    // Remember that we've bound event handlers to this element.
    elem.setAttribute(ATTR_EVENTS_BOUND, 'true');
    elem.setAttribute(ATTR_CURRENT_VAL, placeholder);

    // If the element doesn't have a value and is not focussed, set it to the
    // placeholder string.
    if ( hideOnInput || elem !== safeActiveElement() ) {
      showPlaceholder(elem);
    }
  }

}(this) );
// IE spupport comes in IE10
(function rAFPolyfill() {
    var lastTime, vendors, x;
    lastTime = 0;
    vendors = ["webkit", "moz"];
    x = 0;
    while (x < vendors.length && !window.requestAnimationFrame) {
      window.requestAnimationFrame = window[vendors[x] + "RequestAnimationFrame"];
      window.cancelAnimationFrame = window[vendors[x] + "CancelAnimationFrame"] || window[vendors[x] + "CancelRequestAnimationFrame"];
      ++x;
    }
    if (!window.requestAnimationFrame) {
      window.requestAnimationFrame = function(callback, element) {
        var currTime, id, timeToCall;
        currTime = new Date().getTime();
        timeToCall = Math.max(0, 16 - (currTime - lastTime));
        id = window.setTimeout(function() {
          callback(currTime + timeToCall);
        }, timeToCall);
        lastTime = currTime + timeToCall;
        return id;
      };
    }
    if (!window.cancelAnimationFrame) {
      window.cancelAnimationFrame = function(id) {
        clearTimeout(id);
      };
    }
})();



(function($) {
	'use strict';

	var MK = window.MK || {};

	/**
	 * MK.core holds most important methods that bootstraps whole application
	 * 
	 * @type {Object}
	 */
	MK.core = {};



	/**
	 * State for referance of already loaded script files
	 * @type {Array}
	 */
	var _loadedDependencies = [];

	/**
	 * State of queue represented as pairs of script ref => callback
	 * @type {Object}
	 */
	var _inQueue = {};
	
	/**
	 * Initializes all components in given scope (object or DOM reference) based on data attribute and 'pointer' css class '.js-el'.
	 * DOM work is reduced by single traversing for pointer class and later filtering through cached object. It expects init() method
	 * on every component. Component itself should be defined in MK.component namespace and assign to DOM element via data-mk-component.
	 * Use it once on DOM ready with document as a scope. For partial initialization after ajax operations pass as a scope element
	 * where new DOM was inserted.
	 * 
	 * @param  {string|object}
	 */
	MK.core.initAll = function( scope ) {
		var $el = $( scope ).find( '.js-el' ), // single traversing
			$components = $el.filter( '[data-mk-component]' ),
			component = null;


		// initialize  component
		var init = function init(name, el) {
			var $el = $(el);

			if ( $el.data('init-' + name) ) return; // do not initialize the same module twice

			if ( typeof MK.component[ name ] !== 'function' ) console.log('Component init error: ', name);
			else {
				component = new MK.component[ name ]( el );
				component.init();
				$el.data('init-' + name, true); // mark as initialised
				// TODO add name
				MK.utils.eventManager.publish('component-inited');
			}
		};

		$components.each( function() {
			var self = this,
				$this = $( this ),
				names = $this.data( 'mk-component' );

			if( typeof names === 'string' ) {
				var name = names; // containes only single name. Keep it transparent.
				init(name, self);
			} else {
				names.forEach( function( name ) {
					init(name, self);
				});
			} 
		}); 
	};

	/**
	 * Async loader for 3rd party plugins available from within theme or external CDNs / APIs.
	 * Take one argument as callback which is run when loading is finished. Also keeps track of already loaded scripts 
	 * and prevent duplication. Holds in queue multiple callbacks that where defined in different places but depend on the 
	 * same plugin.
	 *
	 * TODO: heavy test for multiple dependencies and crosssharing one dependency and different one dependency in queue, 
	 * bulletproof with single dependency
	 *
	 * @example MK.core.loadDependencies([MK.core.path.plugins + 'plugin.js'], function() {
	 *          	// do something when plugin is loaded
	 * 			})
	 * 
	 * @param  {array}
	 * @param  {function}
	 */
	MK.core.loadDependencies = function( dependencies, callback ) {
		var _callback = callback || function() {};

        if( !dependencies ) {
        	// If no dependencies defined then run _callback imidietelly
        	_callback(); 
        	return;
        }

		// Check for new dependencies
        var newDeps = dependencies.map( function( dep ) {
            if( _loadedDependencies.indexOf( dep ) === -1 ) {
            	 if( typeof _inQueue[ dep ] === 'undefined' ) {
        			// console.log( dep );
                	return dep;
                } else {
                	_inQueue[ dep ].push( _callback );
                	return true;
                }
            } else {
            	return false;
            }
        });

        // The dependency is not new but it's not resolved yet
        // Callback is added to queue that will be run after the script is loaded
        // Don't run callback just yet.
        if( newDeps[0] === true ) {
        	// console.log('Waiting for ' + dependencies[0]);
        	return;
        }

        // Dependency was loaded previously. We can run callback safely
        if( newDeps[0] === false ) {
        	_callback();
        	return;
        }

        // Create queue and relationship script -> callback array to track
        // all callbacks that waits for ths script
        var queue = newDeps.map( function( script ) {
        	// console.log( script );
        	_inQueue[ script ] = [ _callback ];
            return $.getCachedScript( script );
        });

        // Callbacks invoking
        var onLoad = function onLoad() {
        	var index;
        	newDeps.map( function( loaded ) {
        		_inQueue[ loaded ].forEach( function( callback ) {
        			callback();
        		});
        		delete _inQueue[ loaded ];
                _loadedDependencies.push( loaded );
        	});
        };

        // Run callbacks when promise is resolved
        $.when.apply( null, queue ).done( onLoad );
	};

	/**
	 * Single namespace for all paths recuired in application.
	 * @type {Object}
	 */
	MK.core.path = {
		theme   : mk_theme_dir,
		plugins : mk_theme_js_path + '/plugins/async/min/',
		ajaxUrl : window.PHP.ajax
	};


})(jQuery);
(function($) {
	'use strict';

    var MK = window.MK || {};
	MK.utils = window.MK.utils || {};

    /**
     * Enables to evaluate common methods through DOM JSON references by invoking from object with bracket notation MK.utils[var][var]
     * @type {Object}
     */
    MK.utils.actions = {};

    MK.utils.actions.activate = function (el) {
        $(el).addClass('is-active');
    };
        
    MK.utils.actions.deactivate = function (el) {
        $(el).removeClass('is-active');
    };

}(jQuery));
(function($) {
	'use strict';

    var MK = window.MK || {};
	MK.utils = window.MK.utils || {};

    /**
     * Gets user browser and its version
     * @return {Object} => {name, version}
     */
	MK.utils.browser = (function() {
        var dataBrowser = [
            {string: navigator.userAgent, subString: "Edge", identity: "Edge"},
            {string: navigator.userAgent, subString: "Chrome", identity: "Chrome"},
            {string: navigator.userAgent, subString: "MSIE", identity: "IE"},
            {string: navigator.userAgent, subString: "Trident", identity: "IE"},
            {string: navigator.userAgent, subString: "Firefox", identity: "Firefox"},
            {string: navigator.userAgent, subString: "Safari", identity: "Safari"},
            {string: navigator.userAgent, subString: "Opera", identity: "Opera"}
        ];

		var versionSearchString = null;
        var searchString = function (data) {
            for (var i = 0; i < data.length; i++) {
                var dataString = data[i].string;
                versionSearchString = data[i].subString;

                if (dataString.indexOf(data[i].subString) !== -1) {
                    return data[i].identity;
                }
            }
        };
        
        var searchVersion = function (dataString) {
            var index = dataString.indexOf(versionSearchString);
            if (index === -1) {
                return;
            }

            var rv = dataString.indexOf("rv:");
            if (versionSearchString === "Trident" && rv !== -1) {
                return parseFloat(dataString.substring(rv + 3));
            } else {
                return parseFloat(dataString.substring(index + versionSearchString.length + 1));
            }
        };

        var name = searchString(dataBrowser) || "Other";
        var version = searchVersion(navigator.userAgent) || searchVersion(navigator.appVersion) || "Unknown";

        // Expose for css
        $('html').addClass(name).addClass(name + version);


        return {
        	name : name,
        	version : version
        };
        
	})();

    /**
     * Gets user operating system
     * @return {String}
     */
	MK.utils.OS = (function() {
		if (navigator.appVersion.indexOf("Win")!=-1) return "Windows";
		if (navigator.appVersion.indexOf("Mac")!=-1) return "OSX";
		if (navigator.appVersion.indexOf("X11")!=-1) return "UNIX";
		if (navigator.appVersion.indexOf("Linux")!=-1) return "Linux";
	})();
	
    /**
     * Check if mobile device.
     * @return {Boolean}
     */
	MK.utils.isMobile = function() {
        // Problems with bigger tablets as users raport differences with behaviour. Switch to navigator sniffing
		// return ('ontouchstart' in document.documentElement) && matchMedia( '(max-width: 1024px)' ).matches;
     
        // http://www.abeautifulsite.net/detecting-mobile-devices-with-javascript/
        // if it still brings problem try to move to more sophisticated solution like
        // apachemobilefilter.org
        // detectright.com
        // web.wurfl.io
        // 
        // Seems as best solution here:
        // hgoebl.github.io/mobile-detect.js

        function android() {
            return navigator.userAgent.match(/Android/i);
        }

        function blackBerry() {
            return navigator.userAgent.match(/BlackBerry/i);
        }

        function iOS() {
            return navigator.userAgent.match(/iPhone|iPad|iPod/i);
        }

        function opera() {
            return navigator.userAgent.match(/Opera Mini/i);
        }

        function windows() {
            return navigator.userAgent.match(/IEMobile/i);
        }

        return (android() || blackBerry() || iOS() || opera() || windows() || matchMedia( '(max-width: 1024px)' ).matches); 
            
	};

    /**
     * Check if menu is switched to responsive state based on user width settings
     * @return {Boolean} 
     */
    MK.utils.isResponsiveMenuState = function() {
        return window.matchMedia( '(max-width: '+ mk_responsive_nav_width +'px)').matches;
    };



    MK.utils.getUrlParameter = function getUrlParameter(sParam) {
        var sPageURL = decodeURIComponent(window.location.search.substring(1)),
            sURLVariables = sPageURL.split('&'),
            sParameterName,
            i;

        for (i = 0; i < sURLVariables.length; i++) {
            sParameterName = sURLVariables[i].split('=');

            if (sParameterName[0] === sParam) {
                return sParameterName[1] === undefined ? true : sParameterName[1];
            }
        }
    };


    MK.utils.isSmoothScroll = (function() {
        var isUserChoice = (mk_smooth_scroll === 'true');

        // We notify our app about smooth scroll option when user choose it from admin panel.
        return isUserChoice;
    }());

}(jQuery));
(function($) {
	'use strict';

    var MK = window.MK || {};
	MK.utils = window.MK.utils || {};

	/**
	 * Basic implementation of pub / sub pattern to avoid tight coupling with direct module communication
	 * @type {Object}
	 */
	MK.utils.eventManager = {};

	/**
	 * Subscribe to custom event and run callbacks
	 * @param  {String}
	 * @param  {Function}
	 *
	 * @usage MK.utils.eventManager.subscribe('event', function(e, params) {} )
	 */
	MK.utils.eventManager.subscribe = function(evt, func) {
		$(this).on(evt, func);
	};

	/**
	 * Unsubscribe from custom event
	 * @param  {String}
	 * @param  {Function}
	 */
	MK.utils.eventManager.unsubscribe = function(evt, func) {
		$(this).off(evt, func);
	};

	/**
	 * Publish custom event to notify appliaction about state change
	 * @param  {String}
	 * 
	 * @usage MK.utils.eventManager.publish('event', {
	 *        	param: val
	 *        })
	 */
	MK.utils.eventManager.publish = function(evt, params) {
		$(this).trigger(evt, [params]);
	};

}(jQuery));
(function($) {
	'use strict';

    var MK = window.MK || {};
	MK.utils = window.MK.utils || {};

	/**
	 * Control browser fullscreen mode
	 * @type {Object}
	 */
	MK.utils.fullscreen = {};

	// TODO: move to namespace
	MK.utils.launchIntoFullscreen = function ( element ) {
	    if(element.requestFullscreen) {
	     	element.requestFullscreen();
	  	} else if(element.mozRequestFullScreen) {
	    	element.mozRequestFullScreen();
	  	} else if(element.webkitRequestFullscreen) {
	    	element.webkitRequestFullscreen();
	  	} else if(element.msRequestFullscreen) {
	    	element.msRequestFullscreen();
	  	}
	};

	MK.utils.exitFullscreen = function () {
	  	if(document.exitFullscreen) {
	    	document.exitFullscreen();
	  	} else if(document.mozCancelFullScreen) {
	    	document.mozCancelFullScreen();
	  	} else if(document.webkitExitFullscreen) {
	    	document.webkitExitFullscreen();
	  	}
	};

}(jQuery));
(function($) {
	'use strict';

    var MK = window.MK || {};
	MK.utils = window.MK.utils || {};

	MK.utils.misc = {};
	// TODO: move to namespace

	/**
	 * Get all top offsets from jQuery collection
	 * 
	 * @param  {$Objects}
	 * @return {Aray}
	 */
	MK.utils.offsets = function( $els ) {
		return $.map( $els, function( el ) {
			return $( el ).offset().top;
		});
	};

	/**
	 * Retrive from array of numbers first number that is higher than given parameter
	 * 
	 * @param  {Number}
	 * @param  {Array}
	 * @return {Number}
	 */
	MK.utils.nextHigherVal = function( val, arr ) {
		var i = 0,
			higher = null;

		var check = function() {
			if( val > arr[ i ]) {
				i += 1;
				check();
			} else {
				higher = arr[ i ];
			}
		};
		check();

		return higher;
	};


    MK.utils.throttle = function( delay, fn ) {
        var last;
        var deferTimer;

        return function() {
            var context = this;
            var args = arguments;
            var now = +new Date;
            if( last && now < last + delay ) {
            	clearTimeout( deferTimer );
            	deferTimer = setTimeout( function() { 
            		last = now; fn.apply( context, args ); 
            	}, delay );
          	} else {
            	last = now;
            	fn.apply( context, args );
          	}
        };
    };

})(jQuery); 
(function($) {
	'use strict';

    var MK = window.MK || {};
	MK.utils = window.MK.utils || {};

	/**
	 * Scrolls page to static pixel offset
	 * @param  {Number}
	 */
	MK.utils.scrollTo = function( offset ) {
		$('html, body').stop().animate({
			scrollTop: offset
			}, {
	  		duration: 1200,
	  		easing: "easeInOutExpo"
		});
	};

	/**
	 * Scrolls to element passed in as object or DOM reference
	 * @param  {String|Object}
	 */
	MK.utils.scrollToAnchor = function( hash ) {
		var $target = $( hash );
		// console.log( hash );

		if( ! $target.length ) return;

		var offset  = $target.offset().top;
		offset = offset - MK.val.offsetHeaderHeight( offset );

		if( hash === '#top-of-page' ) window.history.replaceState( undefined, undefined, ' ' );
		else window.history.replaceState( undefined, undefined, hash );

		MK.utils.scrollTo( offset );
	};

	/**
	 * Controls native scroll behaviour
	 * @return {Object} => {disable, enable}
	 */
	MK.utils.scroll = (function() {
        // 37 - left arror, 38 - up arrow, 39 right arrow, 40 down arrow
	    var keys = [38, 40];

        function preventDefault(e) {
          e = e || window.event;
          e.preventDefault();
          e.returnValue = false;  
        }

        function wheel(e) {
          preventDefault(e);
        }

        function keydown(e) {
            for (var i = keys.length; i--;) {
                if (e.keyCode === keys[i]) {
                    preventDefault(e);
                    return;
                }
            }
        }

        function disableScroll() {
            if (window.addEventListener) {
                window.addEventListener('DOMMouseScroll', wheel, false);
            }
          	window.onmousewheel = document.onmousewheel = wheel;
          	document.onkeydown = keydown;
        }

        function enableScroll() {            
          	if (window.removeEventListener) {
                window.removeEventListener('DOMMouseScroll', wheel, false);
            }
            window.onmousewheel = document.onmousewheel = document.onkeydown = null; 
        }	

        return {
        	disable : disableScroll,
        	enable  : enableScroll
        };

	})();

	/**
	 * Checks if passed link element has anchor inside current page. Returns string like '#anchor' if so or false
	 * @param  {String|Object}
	 * @return {String|Boolean}
	 */
	MK.utils.detectAnchor = function( el ) {
		var $this = $( el ),
			loc = window.location,
			currentPage = loc.origin + loc.pathname,
			href = $this.attr( 'href' ),
			linkSplit = (href) ? href.split( '#' ) : '',
			hrefPage  = linkSplit[0] ? linkSplit[0] : '', 
			hrefHash  = linkSplit[1] ? linkSplit[1] : '';

		if( typeof hrefHash !== 'undefined' && hrefHash !== '' ) {
			return '#' + hrefHash;
		} else {
			return false;
		}
	};

	/**
	 * This should be invoked only on page load. 
	 * Scrolls to anchor from  address bar
	 */
	MK.utils.scrollToURLHash = function() {
		var loc = window.location,
			hash = loc.hash;

		if ( hash.length && hash.substring(1).length ) {
			// !loading is added early after DOM is ready to prevent native jump to anchor
			hash = hash.replace( '!loading', '' );

			// Wait for one second before animating 
			// Most of UI animations should be done by then and async operations complited
			setTimeout( function() {
				MK.utils.scrollToAnchor( hash );
			}, 1000 ); 

			// Right after reset back address bar
			setTimeout( function() {
				window.history.replaceState(undefined, undefined, hash);
			}, 1001);
		}
	};

	/**
	 * Scroll Spy implementation. Spy dynamic offsets of elements or static pixel offset
	 * @param  {Number|Element}
	 * @param  {Object} => callback object {before, active, after}
	 */
	MK.utils.scrollSpy = function( toSpy, config ) {
		var $window   = $( window ),
	        container = document.getElementById( 'mk-theme-container' ),
	        isObj     = ( typeof toSpy === 'object' ),
	        offset    = (isObj) ? MK.val.dynamicOffset( toSpy, config.position, config.threshold ) : function() { return toSpy; },
	        height    = (isObj) ? MK.val.dynamicHeight( toSpy ) : function() { return 0; },
	        cacheVals = {},
	        _p 		  = 'before'; // current position

		var checkPosition = function() {
	    	var s = MK.val.scroll(), 
	    		o = offset(),
	    		h = height();

	        if( s < o && _p !== 'before' ) {
	        	// console.log( toSpy, 'before' );
	        	if( config.before ) config.before();
	        	_p = 'before';
	        } 
	        else if( s >= o && s <= o + h && _p !== 'active' ) {
	        	// console.log( toSpy, 'active' );
	        	if( config.active ) config.active( o );
	        	_p = 'active';
	        }
	        else if( s > o + h && _p !== 'after' ) {
	        	// console.log( toSpy, 'after' );
	        	if( config.after) config.after( o + h );
	        	_p = 'after';
	        }
		};

		var rAF = function() {
			window.requestAnimationFrame( checkPosition );
		};

		var exportVals = function() {
			return cacheVals;    
		};

		var updateCache = function() {
	    	var o = offset(),
	    		h = height();
	    		
	        cacheVals = {
	        	before : o - $window.height(),
	        	active : o,
	        	after : o + h
	        };
		};

		if( config.cache ) {
			config.cache( exportVals );
		}

	    checkPosition();
	    $window.on( 'load', checkPosition );
	    $window.on( 'resize', checkPosition );
	    $window.on( 'mouseup', checkPosition );
   		window.addResizeListener( container, checkPosition );

	    $window.on( 'scroll', rAF ); 

   		updateCache();
	    $window.on( 'load', updateCache );
	    $window.on( 'resize', updateCache );
   		window.addResizeListener( container, updateCache );
	};

}(jQuery));
(function($) {
    'use strict';

    // Create delagation event handler to behave as "live" listener. We may provide new elements with ajax etc later
    // Just add js-taphover class whatever element you'd like to immidietely bring hover on touch devices
    $("body").on("click", '.js-taphover', function (e) {
        var $link = $(e.currentTarget); // grab target
        var $target = $(e.target);

        // Rather than ":hover" state we operate on ".hover" class which gives us more control and chance to emulate it on click
        // yet it is easy to reason about in our CSS
        if ($link.hasClass('hover')) {
            return true;
        } else if ( MK.utils.isMobile() ) {
            if ( ($target.hasClass('hover-icon') || $target.closest('.hover-icon').length) && !$target.closest('.js-taphover').hasClass('hover') ) {
                e.preventDefault();
            }
            $link.addClass('hover');
            $('.js-taphover').not(e.currentTarget).removeClass('hover'); // remove it from previous element
            e.stopPropagation(); // do not leak to document root if expected element was touched
        }
    });

    // Whenever click leaks to the root romve all hover classes
    $(document).on("click", function(e) {
        $('.js-taphover').removeClass('hover');
    });

}(jQuery));
// (function() {
//     'use strict';

//     // Make sure the video behaves like background-size: cover
//     window.videoCover = function( holderSelector, videoSelector ) {
//         var videos = document.querySelectorAll( videoSelector ),
//             holder = document.querySelectorAll( holderSelector )[0];

//         [].forEach.call(videos, function(video) {

//             var videoAspectRatio;

//             resizeBackground(); 

//             video.onloadedmetadata = function() {
//                 // get images aspect ratio
//                 videoAspectRatio = this.height / this.width;
//                 // attach resize event and fire it once
//                 window.onresize = resizeBackground;
//                 resizeBackground();
//             };

//             function resizeBackground() {
//                 // get window size and aspect ratio
//                 var holderWidth = holder.innerWidth,
//                     holderHeight = holder.innerHeight,
//                     holderAspectRatio = holderHeight / holderWidth;

//                 //compare holder ratio to image ratio so you know which way the image should fill
//                 if ( holderAspectRatio < videoAspectRatio ) {
//                     // we are fill width
//                     video.style.width = holderWidth + "px";
//                     // and applying the correct aspect to the height now
//                     video.style.height = (holderWidth * videoAspectRatio) + "px"; // this can be margin if your element is not positioned relatively, absolutely or fixed
//                     // make sure image is always centered
//                     video.style.left = "0px";
//                     video.style.top = (holderHeight - (holderWidth * videoAspectRatio)) / 2 + "px";
//                 } else { // same thing as above but filling height instead
//                     video.style.height = holderHeight + "px";
//                     video.style.width = (holderHeight / videoAspectRatio) + "px";
//                     video.style.left = (holderWidth - (holderHeight / videoAspectRatio)) / 2 + "px";
//                     video.style.top = "0px";
//                 }
//             }

//         });
//     };

// }());
// 
// 
// 
// TODO it is temp only. make it as a plugin

(function($) {
    'use strict';

    var $videoHolder = $('.mk-center-video'),
        $wrapper = $videoHolder.parent(),
        baseAspectRatio = 56.25;

    var wrapperHeight,
        wrapperWidth,
        wrapperAspectRatio;

    function calc() {
        wrapperHeight = $wrapper.height();
        wrapperWidth = $wrapper.width();
        wrapperAspectRatio = (wrapperHeight / wrapperWidth) * 100;
    } 

    function apply() {        
        var width = (wrapperAspectRatio / baseAspectRatio) * 100,
            widthOverflow = (width - 100);

        $videoHolder.css({
            'padding-top': wrapperAspectRatio + '%',
            'width': width + '%',
            'left': -(widthOverflow / 2) + '%'
        }); 
    }

    function reset() {
        $videoHolder.css({
            'padding-top': baseAspectRatio + '%',
            'width': 100 + '%',
            'left': 0
        });
    }

    function setCover() {
        reset();
        calc();
        if(wrapperAspectRatio > baseAspectRatio) apply();
    }

    $(window).on('load', setCover);
    $(window).on('resize', setCover);


}(jQuery));
(function($) {
    'use strict';

    var MK = window.MK || {};

    /**
     * 	MK.val is collection of Lambdas responsible for returning up to date values of method type like scrollY or el offset.
     * 	The Lambda is responsible for keeping track of value of a particular property, usually takes as argument an object 
     * 	(or DOM reference) and internally creates and updates data that is returned as primitive value - through variable reference.
     *
     *  Benefits of this approach:
     *  - reduced DOM reads
     *  - auto-updating values without need for additional logic where methods are called
     *  - updating values when needed to be updated not read
     *
     *  Downsides:
     *  - Memory overhead with closures and keeping state in memory ( still beter than read state from DOM, but use wisely - 
     *    do not use it when you really need static value on runtime )
     */
    MK.val = {};

    /**
     * Current window offsetY position
     *
     * @uses   MK.val.scroll()
     * @return {number}
     */
    MK.val.scroll = (function() {
        var offset = 0,
            $window = $(window),
            hasPageYOffset = (window.pageYOffset !== undefined),
            body = (document.documentElement || document.body.parentNode || document.body); // cross browser handling

        var update = function() {
            offset = hasPageYOffset ? window.pageYOffset : body.scrollTop;
        };

        var rAF = function() {
            window.requestAnimationFrame(update);
        };

        update();
        $window.on('load', update);
        $window.on('resize', update);
        $window.on('scroll', rAF);

        return function() {
            return offset;
        };
    })();


    /**
     * Changes number of percent to pixels based on viewport height
     *
     * @uses   MK.val.viewportPercentHeight({percent val})
     * @param  {number}
     * @return {number}
     */
    MK.val.viewportPercentHeight = function(percent) {
        return $(window).height() * (percent / 100);
    };


    /**
     * Wordpress adminbar height based on wp media queries
     * @return {Number}
     */
    MK.val.adminbarHeight = function() {
        if (php.hasAdminbar) {
            // apply WP native media-query and sizes
            return (window.matchMedia('( max-width: 782px )').matches) ? 46 : 32;
        } else {
            return 0;
        }
    };


    /**
     * Offset when header becomes sticky. Evaluates viewport % and header height to pixels for according options
     * @return {Number}
     */
    MK.val.stickyOffset = (function() {
        var $header = $('.mk-header').not('.js-header-shortcode').first();

        // We need to have returning function even when header is disabled
        if (!$header.length) {
            return function() {
                return 0;
            };
        }



        var $toolbar = $header.find('.mk-header-toolbar'),
            config = $header.data(),
            hasToolbar = $toolbar.length,
            toolbarHeight = (hasToolbar) ? $toolbar.height() : 0,
            isVertical = (config.headerStyle === 4),
            headerHeight = (isVertical) ? 0 : config.height;

        var type = ((typeof config.stickyOffset === 'number') ? 'number' : false) ||
            ((config.stickyOffset === 'header') ? 'header' : false) ||
            'percent';

        var stickyOffset = 0;
        var setOffset = function() {

        	//we calculate toolbar height for When the device is changed Size
        	//Toolbar height in responsive state is 0 
            toolbarHeight = (hasToolbar) ? $toolbar.height() : 0;

            if (MK.utils.isResponsiveMenuState()) {
                headerHeight = config.responsiveHeight;

                if (hasToolbar) {
                    if ($toolbar.is(':hidden')) {
                        toolbarHeight = 0;
                    }
                }
            }

            if (type === 'number') {
                stickyOffset = config.stickyOffset;
            } else if (type === 'header') {

                stickyOffset = headerHeight + toolbarHeight + MK.val.adminbarHeight(); // add all header components here, make them 0 if needed

            } else if (type === 'percent') {
                stickyOffset = MK.val.viewportPercentHeight(parseInt(config.stickyOffset));
            }
        };

        setOffset();
        $(window).on('resize', setOffset);

        return function() {
            return stickyOffset;
        };
    }());



    /**
     * Gets header height on particular offsetY position. Use to determine logic for fullHeight, smooth scroll etc.
     * Takes one parameter which is offset position we're interested in.
     *
     * @uses   MK.val.offsetHeaderHeight({offset val})
     * @param  {number}
     * @return {number}
     */
    MK.val.offsetHeaderHeight = (function() { // Closure avoids multiple DOM reads. We need to fetch header config only once.
        var $header = $('.mk-header').not('.js-header-shortcode').first();

        // We need to have returning function even when header is disabled
        if (!$header.length) {
            return function() {
                return 0;
            };
        }

        var $toolbar = $header.find('.mk-header-toolbar'),
            config = $header.data(),
            stickyHeight = config.stickyHeight,
            desktopHeight = config.height,
            mobileHeight = config.responsiveHeight,
            isTransparent = $header.hasClass('transparent-header'),
            isSticky = config.stickyStyle.length,
            isStickyLazy = config.stickyStyle === 'lazy',
            isVertical = config.headerStyle === 4,
            hasToolbar = $toolbar.length,
            toolbarHeight = hasToolbar ? $toolbar.height() : 0,
            bufor = 5;


        // if header has border bottom we can calculate that (for responsive state)
        var $innerHeader = $header.find('.mk-header-inner');
        var hasInnerHeader = $innerHeader.length;

        var headerHeight = function(offset) {

            toolbarHeight = hasToolbar ? $toolbar.height() : 0
            var stickyOffset = MK.val.stickyOffset();


            if (MK.utils.isResponsiveMenuState()) { //  Header avaible only on top for mobile

                if (hasToolbar && $toolbar.is(':hidden')) {
                    toolbarHeight = 0;
                }

                //in responsive state , .mk-header-holder position's changed to "relative" 
                //and header's border affected to offset,so borders must be calculated 
                var headerBorder = 0;
                headerBorder = parseInt($innerHeader.css('border-bottom-width'));

                var totalHeight = mobileHeight + MK.val.adminbarHeight() + toolbarHeight + headerBorder;

                if (offset <= totalHeight) return totalHeight;
                else return MK.val.adminbarHeight();
            } else {
                if (offset <= stickyOffset) {
                    if (isVertical) {
                        if (hasToolbar) {
                            return toolbarHeight + MK.val.adminbarHeight();
                        } else {
                            return MK.val.adminbarHeight();
                        }
                    } else if (isTransparent) {
                        return MK.val.adminbarHeight();
                    } else {
                        return desktopHeight + toolbarHeight + MK.val.adminbarHeight();
                    } // For any other return regular desktop height
                } else if (offset > stickyOffset) {
                    if (isVertical) {
                        return MK.val.adminbarHeight();
                    } else if (!isSticky) {
                        return MK.val.adminbarHeight();
                    } else if (isStickyLazy) {
                        return MK.val.adminbarHeight();
                    } else if (isSticky) {
                        return stickyHeight + MK.val.adminbarHeight();
                    }
                }
            }
            // default to 0 to prevent errors ( need to return number )
            // Anyway make sure all scenarios are covered in IFs
            return 0;
        };

        return function(offset) {
            return headerHeight(offset - MK.val.adminbarHeight());
        };
    })();


    /**
     * Gets current offset of given element (passed as object or DOM reference) from top or bottom (default to top) 
     * of screen  with possible threshold (default to 0)
     * 
     * @uses   MK.val.dynamicOffset({obj reference}, {'top'|'bottom'}, {threshold val})
     * @param  {string|object}
     * @param  {string}
     * @param  {number}
     * @return {number}
     */
    MK.val.dynamicOffset = function(el, position, threshold) {
        var $window = $(window),
            $el = $(el),
            pos = position || 'top',
            thr = threshold || 0,
            container = document.getElementById('mk-theme-container'),
            currentPos = 0;

        var offset = 0,
            winH = 0,
            rect = 0,
            x = 0;

        var update = function() {
            winH = $window.height();
            rect = $el[0].getBoundingClientRect();
            offset = (rect.top + MK.val.scroll());
            x = (pos === 'top') ? MK.val.offsetHeaderHeight(offset) : winH + (rect.height - thr);
            currentPos = offset - x - 1;
        };

        update();
        $window.on('load', update);
        $window.on('resize', update);
        window.addResizeListener(container, update);

        return function() {
            return currentPos;
        };
    };

    /**
     * Gets current height of given element (passed as object or DOM reference)
     * 
     * @uses   MK.val.dynamicHeight({obj reference})
     * @param  {string|object}
     * @return {number}
     */
    MK.val.dynamicHeight = function(el) {
        var $window = $(window),
            $el = $(el),
            container = document.getElementById('mk-theme-container'),
            currentHeight = 0;

        var update = function() {
            currentHeight = $el.outerHeight();
        };

        update();
        $window.on('load', update);
        $window.on('resize', update);
        window.addResizeListener(container, update);

        return function() {
            return currentHeight;
        };
    };

})(jQuery);

/*
 * jQuery Easing v1.3 - http://gsgd.co.uk/sandbox/jquery/easing/
 *
 */
jQuery.easing["jswing"] = jQuery.easing["swing"];
jQuery.extend(jQuery.easing, {
        def: "easeOutQuad",
        swing: function (a, b, c, d, e) {
                return jQuery.easing[jQuery.easing.def](a, b, c, d, e)
        },
        easeInQuad: function (a, b, c, d, e) {
                return d * (b /= e) * b + c
        },
        easeOutQuad: function (a, b, c, d, e) {
                return -d * (b /= e) * (b - 2) + c
        },
        easeInOutQuad: function (a, b, c, d, e) {
                if ((b /= e / 2) < 1) return d / 2 * b * b + c;
                return -d / 2 * (--b * (b - 2) - 1) + c
        },
        easeInCubic: function (a, b, c, d, e) {
                return d * (b /= e) * b * b + c
        },
        easeOutCubic: function (a, b, c, d, e) {
                return d * ((b = b / e - 1) * b * b + 1) + c
        },
        easeInOutCubic: function (a, b, c, d, e) {
                if ((b /= e / 2) < 1) return d / 2 * b * b * b + c;
                return d / 2 * ((b -= 2) * b * b + 2) + c
        },
        easeInQuart: function (a, b, c, d, e) {
                return d * (b /= e) * b * b * b + c
        },
        easeOutQuart: function (a, b, c, d, e) {
                return -d * ((b = b / e - 1) * b * b * b - 1) + c
        },
        easeInOutQuart: function (a, b, c, d, e) {
                if ((b /= e / 2) < 1) return d / 2 * b * b * b * b + c;
                return -d / 2 * ((b -= 2) * b * b * b - 2) + c
        },
        easeInQuint: function (a, b, c, d, e) {
                return d * (b /= e) * b * b * b * b + c
        },
        easeOutQuint: function (a, b, c, d, e) {
                return d * ((b = b / e - 1) * b * b * b * b + 1) + c
        },
        easeInOutQuint: function (a, b, c, d, e) {
                if ((b /= e / 2) < 1) return d / 2 * b * b * b * b * b + c;
                return d / 2 * ((b -= 2) * b * b * b * b + 2) + c
        },
        easeInSine: function (a, b, c, d, e) {
                return -d * Math.cos(b / e * (Math.PI / 2)) + d + c
        },
        easeOutSine: function (a, b, c, d, e) {
                return d * Math.sin(b / e * (Math.PI / 2)) + c
        },
        easeInOutSine: function (a, b, c, d, e) {
                return -d / 2 * (Math.cos(Math.PI * b / e) - 1) + c
        },
        easeInExpo: function (a, b, c, d, e) {
                return b == 0 ? c : d * Math.pow(2, 10 * (b / e - 1)) + c
        },
        easeOutExpo: function (a, b, c, d, e) {
                return b == e ? c + d : d * (-Math.pow(2, -10 * b / e) + 1) + c
        },
        easeInOutExpo: function (a, b, c, d, e) {
                if (b == 0) return c;
                if (b == e) return c + d;
                if ((b /= e / 2) < 1) return d / 2 * Math.pow(2, 10 * (b - 1)) + c;
                return d / 2 * (-Math.pow(2, -10 * --b) + 2) + c
        },
        easeInCirc: function (a, b, c, d, e) {
                return -d * (Math.sqrt(1 - (b /= e) * b) - 1) + c
        },
        easeOutCirc: function (a, b, c, d, e) {
                return d * Math.sqrt(1 - (b = b / e - 1) * b) + c
        },
        easeInOutCirc: function (a, b, c, d, e) {
                if ((b /= e / 2) < 1) return -d / 2 * (Math.sqrt(1 - b * b) - 1) + c;
                return d / 2 * (Math.sqrt(1 - (b -= 2) * b) + 1) + c
        },
        easeInElastic: function (a, b, c, d, e) {
                var f = 1.70158;
                var g = 0;
                var h = d;
                if (b == 0) return c;
                if ((b /= e) == 1) return c + d;
                if (!g) g = e * .3;
                if (h < Math.abs(d)) {
                        h = d;
                        var f = g / 4
                } else var f = g / (2 * Math.PI) * Math.asin(d / h);
                return -(h * Math.pow(2, 10 * (b -= 1)) * Math.sin((b * e - f) * 2 * Math.PI / g)) + c
        },
        easeOutElastic: function (a, b, c, d, e) {
                var f = 1.70158;
                var g = 0;
                var h = d;
                if (b == 0) return c;
                if ((b /= e) == 1) return c + d;
                if (!g) g = e * .3;
                if (h < Math.abs(d)) {
                        h = d;
                        var f = g / 4
                } else var f = g / (2 * Math.PI) * Math.asin(d / h);
                return h * Math.pow(2, -10 * b) * Math.sin((b * e - f) * 2 * Math.PI / g) + d + c
        },
        easeInOutElastic: function (a, b, c, d, e) {
                var f = 1.70158;
                var g = 0;
                var h = d;
                if (b == 0) return c;
                if ((b /= e / 2) == 2) return c + d;
                if (!g) g = e * .3 * 1.5;
                if (h < Math.abs(d)) {
                        h = d;
                        var f = g / 4
                } else var f = g / (2 * Math.PI) * Math.asin(d / h);
                if (b < 1) return -.5 * h * Math.pow(2, 10 * (b -= 1)) * Math.sin((b * e - f) * 2 * Math.PI / g) + c;
                return h * Math.pow(2, -10 * (b -= 1)) * Math.sin((b * e - f) * 2 * Math.PI / g) * .5 + d + c
        },
        easeInBack: function (a, b, c, d, e, f) {
                if (f == undefined) f = 1.70158;
                return d * (b /= e) * b * ((f + 1) * b - f) + c
        },
        easeOutBack: function (a, b, c, d, e, f) {
                if (f == undefined) f = 1.70158;
                return d * ((b = b / e - 1) * b * ((f + 1) * b + f) + 1) + c
        },
        easeInOutBack: function (a, b, c, d, e, f) {
                if (f == undefined) f = 1.70158;
                if ((b /= e / 2) < 1) return d / 2 * b * b * (((f *= 1.525) + 1) * b - f) + c;
                return d / 2 * ((b -= 2) * b * (((f *= 1.525) + 1) * b + f) + 2) + c
        },
        easeInBounce: function (a, b, c, d, e) {
                return d - jQuery.easing.easeOutBounce(a, e - b, 0, d, e) + c
        },
        easeOutBounce: function (a, b, c, d, e) {
                if ((b /= e) < 1 / 2.75) {
                        return d * 7.5625 * b * b + c
                } else if (b < 2 / 2.75) {
                        return d * (7.5625 * (b -= 1.5 / 2.75) * b + .75) + c
                } else if (b < 2.5 / 2.75) {
                        return d * (7.5625 * (b -= 2.25 / 2.75) * b + .9375) + c
                } else {
                        return d * (7.5625 * (b -= 2.625 / 2.75) * b + .984375) + c
                }
        },
        easeInOutBounce: function (a, b, c, d, e) {
                if (b < e / 2) return jQuery.easing.easeInBounce(a, b * 2, 0, d, e) * .5 + c;
                return jQuery.easing.easeOutBounce(a, b * 2 - e, 0, d, e) * .5 + d * .5 + c
        }
});

/*! fancyBox v2.1.5 fancyapps.com | fancyapps.com/fancybox/#license */
(function(s, H, f, w) {
    var K = f("html"),
        q = f(s),
        p = f(H),
        b = f.fancybox = function() {
            b.open.apply(this, arguments)
        },
        J = navigator.userAgent.match(/msie/i),
        C = null,
        t = H.createTouch !== w,
        u = function(a) {
            return a && a.hasOwnProperty && a instanceof f
        },
        r = function(a) {
            return a && "string" === f.type(a)
        },
        F = function(a) {
            return r(a) && 0 < a.indexOf("%")
        },
        m = function(a, d) {
            var e = parseInt(a, 10) || 0;
            d && F(a) && (e *= b.getViewport()[d] / 100);
            return Math.ceil(e)
        },
        x = function(a, b) {
            return m(a, b) + "px"
        };
    f.extend(b, {
        version: "2.1.5",
        defaults: {
            padding: 15,
            margin: 20,
            width: 800,
            height: 600,
            minWidth: 100,
            minHeight: 100,
            maxWidth: 9999,
            maxHeight: 9999,
            pixelRatio: 1,
            autoSize: !0,
            autoHeight: !1,
            autoWidth: !1,
            autoResize: !0,
            autoCenter: !t,
            fitToView: !0,
            aspectRatio: !1,
            topRatio: 0.5,
            leftRatio: 0.5,
            scrolling: "auto",
            wrapCSS: "",
            arrows: !0,
            closeBtn: !0,
            closeClick: !1,
            nextClick: !1,
            mouseWheel: !0,
            autoPlay: !1,
            playSpeed: 3E3,
            preload: 3,
            modal: !1,
            loop: !0,
            ajax: {
                dataType: "html",
                headers: {
                    "X-fancyBox": !0
                }
            },
            iframe: {
                scrolling: "auto",
                preload: !0
            },
            swf: {
                wmode: "transparent",
                allowfullscreen: "true",
                allowscriptaccess: "always"
            },
            keys: {
                next: {
                    13: "left",
                    34: "up",
                    39: "left",
                    40: "up"
                },
                prev: {
                    8: "right",
                    33: "down",
                    37: "right",
                    38: "down"
                },
                close: [27],
                play: [32],
                toggle: [70]
            },
            direction: {
                next: "left",
                prev: "right"
            },
            scrollOutside: !0,
            index: 0,
            type: null,
            href: null,
            content: null,
            title: null,
            tpl: {
                wrap: '<div class="fancybox-wrap" tabIndex="-1"><div class="fancybox-skin"><div class="fancybox-outer"><div class="fancybox-inner"></div></div></div></div>',
                image: '<img class="fancybox-image" src="{href}" alt="" />',
                iframe: '<iframe id="fancybox-frame{rnd}" name="fancybox-frame{rnd}" class="fancybox-iframe" frameborder="0" vspace="0" hspace="0" webkitAllowFullScreen mozallowfullscreen allowFullScreen' +
                    (J ? ' allowtransparency="true"' : "") + "></iframe>",
                error: '<p class="fancybox-error">The requested content cannot be loaded.<br/>Please try again later.</p>',
                closeBtn: '<a title="Close" class="fancybox-item fancybox-close" href="javascript:;"></a>',
                next: '<a title="Next" class="fancybox-nav fancybox-next" href="javascript:;"><span></span></a>',
                prev: '<a title="Previous" class="fancybox-nav fancybox-prev" href="javascript:;"><span></span></a>'
            },
            openEffect: "fade",
            openSpeed: 250,
            openEasing: "swing",
            openOpacity: !0,
            openMethod: "zoomIn",
            closeEffect: "fade",
            closeSpeed: 250,
            closeEasing: "swing",
            closeOpacity: !0,
            closeMethod: "zoomOut",
            nextEffect: "elastic",
            nextSpeed: 250,
            nextEasing: "swing",
            nextMethod: "changeIn",
            prevEffect: "elastic",
            prevSpeed: 250,
            prevEasing: "swing",
            prevMethod: "changeOut",
            helpers: {
                overlay: !0,
                title: !0
            },
            onCancel: f.noop,
            beforeLoad: f.noop,
            afterLoad: f.noop,
            beforeShow: f.noop,
            afterShow: f.noop,
            beforeChange: f.noop,
            beforeClose: f.noop,
            afterClose: f.noop
        },
        group: {},
        opts: {},
        previous: null,
        coming: null,
        current: null,
        isActive: !1,
        isOpen: !1,
        isOpened: !1,
        wrap: null,
        skin: null,
        outer: null,
        inner: null,
        player: {
            timer: null,
            isActive: !1
        },
        ajaxLoad: null,
        imgPreload: null,
        transitions: {},
        helpers: {},
        open: function(a, d) {
            if (a && (f.isPlainObject(d) || (d = {}), !1 !== b.close(!0))) return f.isArray(a) || (a = u(a) ? f(a).get() : [a]), f.each(a, function(e, c) {
                var l = {},
                    g, h, k, n, m;
                "object" === f.type(c) && (c.nodeType && (c = f(c)), u(c) ? (l = {
                        href: c.data("fancybox-href") || c.attr("href"),
                        title: f("<div/>").text(c.data("fancybox-title") || c.attr("title")).html(),
                        isDom: !0,
                        element: c
                    },
                    f.metadata && f.extend(!0, l, c.metadata())) : l = c);
                g = d.href || l.href || (r(c) ? c : null);
                h = d.title !== w ? d.title : l.title || "";
                n = (k = d.content || l.content) ? "html" : d.type || l.type;
                !n && l.isDom && (n = c.data("fancybox-type"), n || (n = (n = c.prop("class").match(/fancybox\.(\w+)/)) ? n[1] : null));
                r(g) && (n || (b.isImage(g) ? n = "image" : b.isSWF(g) ? n = "swf" : "#" === g.charAt(0) ? n = "inline" : r(c) && (n = "html", k = c)), "ajax" === n && (m = g.split(/\s+/, 2), g = m.shift(), m = m.shift()));
                k || ("inline" === n ? g ? k = f(r(g) ? g.replace(/.*(?=#[^\s]+$)/, "") : g) : l.isDom && (k = c) :
                    "html" === n ? k = g : n || g || !l.isDom || (n = "inline", k = c));
                f.extend(l, {
                    href: g,
                    type: n,
                    content: k,
                    title: h,
                    selector: m
                });
                a[e] = l
            }), b.opts = f.extend(!0, {}, b.defaults, d), d.keys !== w && (b.opts.keys = d.keys ? f.extend({}, b.defaults.keys, d.keys) : !1), b.group = a, b._start(b.opts.index)
        },
        cancel: function() {
            var a = b.coming;
            a && !1 === b.trigger("onCancel") || (b.hideLoading(), a && (b.ajaxLoad && b.ajaxLoad.abort(), b.ajaxLoad = null, b.imgPreload && (b.imgPreload.onload = b.imgPreload.onerror = null), a.wrap && a.wrap.stop(!0, !0).trigger("onReset").remove(),
                b.coming = null, b.current || b._afterZoomOut(a)))
        },
        close: function(a) {
            b.cancel();
            !1 !== b.trigger("beforeClose") && (b.unbindEvents(), b.isActive && (b.isOpen && !0 !== a ? (b.isOpen = b.isOpened = !1, b.isClosing = !0, f(".fancybox-item, .fancybox-nav").remove(), b.wrap.stop(!0, !0).removeClass("fancybox-opened"), b.transitions[b.current.closeMethod]()) : (f(".fancybox-wrap").stop(!0).trigger("onReset").remove(), b._afterZoomOut())))
        },
        play: function(a) {
            var d = function() {
                    clearTimeout(b.player.timer)
                },
                e = function() {
                    d();
                    b.current && b.player.isActive &&
                        (b.player.timer = setTimeout(b.next, b.current.playSpeed))
                },
                c = function() {
                    d();
                    p.unbind(".player");
                    b.player.isActive = !1;
                    b.trigger("onPlayEnd")
                };
            !0 === a || !b.player.isActive && !1 !== a ? b.current && (b.current.loop || b.current.index < b.group.length - 1) && (b.player.isActive = !0, p.bind({
                "onCancel.player beforeClose.player": c,
                "onUpdate.player": e,
                "beforeLoad.player": d
            }), e(), b.trigger("onPlayStart")) : c()
        },
        next: function(a) {
            var d = b.current;
            d && (r(a) || (a = d.direction.next), b.jumpto(d.index + 1, a, "next"))
        },
        prev: function(a) {
            var d =
                b.current;
            d && (r(a) || (a = d.direction.prev), b.jumpto(d.index - 1, a, "prev"))
        },
        jumpto: function(a, d, e) {
            var c = b.current;
            c && (a = m(a), b.direction = d || c.direction[a >= c.index ? "next" : "prev"], b.router = e || "jumpto", c.loop && (0 > a && (a = c.group.length + a % c.group.length), a %= c.group.length), c.group[a] !== w && (b.cancel(), b._start(a)))
        },
        reposition: function(a, d) {
            var e = b.current,
                c = e ? e.wrap : null,
                l;
            c && (l = b._getPosition(d), a && "scroll" === a.type ? (delete l.position, c.stop(!0, !0).animate(l, 200)) : (c.css(l), e.pos = f.extend({}, e.dim, l)))
        },
        update: function(a) {
            var d = a && a.originalEvent && a.originalEvent.type,
                e = !d || "orientationchange" === d;
            e && (clearTimeout(C), C = null);
            b.isOpen && !C && (C = setTimeout(function() {
                var c = b.current;
                c && !b.isClosing && (b.wrap.removeClass("fancybox-tmp"), (e || "load" === d || "resize" === d && c.autoResize) && b._setDimension(), "scroll" === d && c.canShrink || b.reposition(a), b.trigger("onUpdate"), C = null)
            }, e && !t ? 0 : 300))
        },
        toggle: function(a) {
            b.isOpen && (b.current.fitToView = "boolean" === f.type(a) ? a : !b.current.fitToView, t && (b.wrap.removeAttr("style").addClass("fancybox-tmp"),
                b.trigger("onUpdate")), b.update())
        },
        hideLoading: function() {
            p.unbind(".loading");
            f("#fancybox-loading").remove()
        },
        showLoading: function() {
            var a, d;
            b.hideLoading();
            a = f('<div id="fancybox-loading"><div></div></div>').click(b.cancel).appendTo("body");
            p.bind("keydown.loading", function(a) {
                27 === (a.which || a.keyCode) && (a.preventDefault(), b.cancel())
            });
            b.defaults.fixed || (d = b.getViewport(), a.css({
                position: "absolute",
                top: 0.5 * d.h + d.y,
                left: 0.5 * d.w + d.x
            }));
            b.trigger("onLoading")
        },
        getViewport: function() {
            var a = b.current &&
                b.current.locked || !1,
                d = {
                    x: q.scrollLeft(),
                    y: q.scrollTop()
                };
            a && a.length ? (d.w = a[0].clientWidth, d.h = a[0].clientHeight) : (d.w = t && s.innerWidth ? s.innerWidth : q.width(), d.h = t && s.innerHeight ? s.innerHeight : q.height());
            return d
        },
        unbindEvents: function() {
            b.wrap && u(b.wrap) && b.wrap.unbind(".fb");
            p.unbind(".fb");
            q.unbind(".fb")
        },
        bindEvents: function() {
            var a = b.current,
                d;
            a && (q.bind("orientationchange.fb" + (t ? "" : " resize.fb") + (a.autoCenter && !a.locked ? " scroll.fb" : ""), b.update), (d = a.keys) && p.bind("keydown.fb", function(e) {
                var c =
                    e.which || e.keyCode,
                    l = e.target || e.srcElement;
                if (27 === c && b.coming) return !1;
                e.ctrlKey || e.altKey || e.shiftKey || e.metaKey || l && (l.type || f(l).is("[contenteditable]")) || f.each(d, function(d, l) {
                    if (1 < a.group.length && l[c] !== w) return b[d](l[c]), e.preventDefault(), !1;
                    if (-1 < f.inArray(c, l)) return b[d](), e.preventDefault(), !1
                })
            }), f.fn.mousewheel && a.mouseWheel && b.wrap.bind("mousewheel.fb", function(d, c, l, g) {
                for (var h = f(d.target || null), k = !1; h.length && !(k || h.is(".fancybox-skin") || h.is(".fancybox-wrap"));) k = h[0] && !(h[0].style.overflow &&
                    "hidden" === h[0].style.overflow) && (h[0].clientWidth && h[0].scrollWidth > h[0].clientWidth || h[0].clientHeight && h[0].scrollHeight > h[0].clientHeight), h = f(h).parent();
                0 !== c && !k && 1 < b.group.length && !a.canShrink && (0 < g || 0 < l ? b.prev(0 < g ? "down" : "left") : (0 > g || 0 > l) && b.next(0 > g ? "up" : "right"), d.preventDefault())
            }))
        },
        trigger: function(a, d) {
            var e, c = d || b.coming || b.current;
            if (c) {
                f.isFunction(c[a]) && (e = c[a].apply(c, Array.prototype.slice.call(arguments, 1)));
                if (!1 === e) return !1;
                c.helpers && f.each(c.helpers, function(d, e) {
                    if (e &&
                        b.helpers[d] && f.isFunction(b.helpers[d][a])) b.helpers[d][a](f.extend(!0, {}, b.helpers[d].defaults, e), c)
                })
            }
            p.trigger(a)
        },
        isImage: function(a) {
            return r(a) && a.match(/(^data:image\/.*,)|(\.(jp(e|g|eg)|gif|png|bmp|webp|svg)((\?|#).*)?$)/i)
        },
        isSWF: function(a) {
            return r(a) && a.match(/\.(swf)((\?|#).*)?$/i)
        },
        _start: function(a) {
            var d = {},
                e, c;
            a = m(a);
            e = b.group[a] || null;
            if (!e) return !1;
            d = f.extend(!0, {}, b.opts, e);
            e = d.margin;
            c = d.padding;
            "number" === f.type(e) && (d.margin = [e, e, e, e]);
            "number" === f.type(c) && (d.padding = [c, c,
                c, c
            ]);
            d.modal && f.extend(!0, d, {
                closeBtn: !1,
                closeClick: !1,
                nextClick: !1,
                arrows: !1,
                mouseWheel: !1,
                keys: null,
                helpers: {
                    overlay: {
                        closeClick: !1
                    }
                }
            });
            d.autoSize && (d.autoWidth = d.autoHeight = !0);
            "auto" === d.width && (d.autoWidth = !0);
            "auto" === d.height && (d.autoHeight = !0);
            d.group = b.group;
            d.index = a;
            b.coming = d;
            if (!1 === b.trigger("beforeLoad")) b.coming = null;
            else {
                c = d.type;
                e = d.href;
                if (!c) return b.coming = null, b.current && b.router && "jumpto" !== b.router ? (b.current.index = a, b[b.router](b.direction)) : !1;
                b.isActive = !0;
                if ("image" ===
                    c || "swf" === c) d.autoHeight = d.autoWidth = !1, d.scrolling = "visible";
                "image" === c && (d.aspectRatio = !0);
                "iframe" === c && t && (d.scrolling = "scroll");
                d.wrap = f(d.tpl.wrap).addClass("fancybox-" + (t ? "mobile" : "desktop") + " fancybox-type-" + c + " fancybox-tmp " + d.wrapCSS).appendTo(d.parent || "body");
                f.extend(d, {
                    skin: f(".fancybox-skin", d.wrap),
                    outer: f(".fancybox-outer", d.wrap),
                    inner: f(".fancybox-inner", d.wrap)
                });
                f.each(["Top", "Right", "Bottom", "Left"], function(a, b) {
                    d.skin.css("padding" + b, x(d.padding[a]))
                });
                b.trigger("onReady");
                if ("inline" === c || "html" === c) {
                    if (!d.content || !d.content.length) return b._error("content")
                } else if (!e) return b._error("href");
                "image" === c ? b._loadImage() : "ajax" === c ? b._loadAjax() : "iframe" === c ? b._loadIframe() : b._afterLoad()
            }
        },
        _error: function(a) {
            f.extend(b.coming, {
                type: "html",
                autoWidth: !0,
                autoHeight: !0,
                minWidth: 0,
                minHeight: 0,
                scrolling: "no",
                hasError: a,
                content: b.coming.tpl.error
            });
            b._afterLoad()
        },
        _loadImage: function() {
            var a = b.imgPreload = new Image;
            a.onload = function() {
                this.onload = this.onerror = null;
                b.coming.width =
                    this.width / b.opts.pixelRatio;
                b.coming.height = this.height / b.opts.pixelRatio;
                b._afterLoad()
            };
            a.onerror = function() {
                this.onload = this.onerror = null;
                b._error("image")
            };
            a.src = b.coming.href;
            !0 !== a.complete && b.showLoading()
        },
        _loadAjax: function() {
            var a = b.coming;
            b.showLoading();
            b.ajaxLoad = f.ajax(f.extend({}, a.ajax, {
                url: a.href,
                error: function(a, e) {
                    b.coming && "abort" !== e ? b._error("ajax", a) : b.hideLoading()
                },
                success: function(d, e) {
                    "success" === e && (a.content = d, b._afterLoad())
                }
            }))
        },
        _loadIframe: function() {
            var a = b.coming,
                d = f(a.tpl.iframe.replace(/\{rnd\}/g, (new Date).getTime())).attr("scrolling", t ? "auto" : a.iframe.scrolling).attr("src", a.href);
            f(a.wrap).bind("onReset", function() {
                try {
                    f(this).find("iframe").hide().attr("src", "//about:blank").end().empty()
                } catch (a) {}
            });
            a.iframe.preload && (b.showLoading(), d.one("load", function() {
                f(this).data("ready", 1);
                t || f(this).bind("load.fb", b.update);
                f(this).parents(".fancybox-wrap").width("100%").removeClass("fancybox-tmp").show();
                b._afterLoad()
            }));
            a.content = d.appendTo(a.inner);
            a.iframe.preload ||
                b._afterLoad()
        },
        _preloadImages: function() {
            var a = b.group,
                d = b.current,
                e = a.length,
                c = d.preload ? Math.min(d.preload, e - 1) : 0,
                f, g;
            for (g = 1; g <= c; g += 1) f = a[(d.index + g) % e], "image" === f.type && f.href && ((new Image).src = f.href)
        },
        _afterLoad: function() {
            var a = b.coming,
                d = b.current,
                e, c, l, g, h;
            b.hideLoading();
            if (a && !1 !== b.isActive)
                if (!1 === b.trigger("afterLoad", a, d)) a.wrap.stop(!0).trigger("onReset").remove(), b.coming = null;
                else {
                    d && (b.trigger("beforeChange", d), d.wrap.stop(!0).removeClass("fancybox-opened").find(".fancybox-item, .fancybox-nav").remove());
                    b.unbindEvents();
                    e = a.content;
                    c = a.type;
                    l = a.scrolling;
                    f.extend(b, {
                        wrap: a.wrap,
                        skin: a.skin,
                        outer: a.outer,
                        inner: a.inner,
                        current: a,
                        previous: d
                    });
                    g = a.href;
                    switch (c) {
                        case "inline":
                        case "ajax":
                        case "html":
                            a.selector ? e = f("<div>").html(e).find(a.selector) : u(e) && (e.data("fancybox-placeholder") || e.data("fancybox-placeholder", f('<div class="fancybox-placeholder"></div>').insertAfter(e).hide()), e = e.show().detach(), a.wrap.bind("onReset", function() {
                                f(this).find(e).length && e.hide().replaceAll(e.data("fancybox-placeholder")).data("fancybox-placeholder", !1)
                            }));
                            break;
                        case "image":
                            e = a.tpl.image.replace(/\{href\}/g, g);
                            break;
                        case "swf":
                            e = '<object id="fancybox-swf" classid="clsid:D27CDB6E-AE6D-11cf-96B8-444553540000" width="100%" height="100%"><param name="movie" value="' + g + '"></param>', h = "", f.each(a.swf, function(a, b) {
                                e += '<param name="' + a + '" value="' + b + '"></param>';
                                h += " " + a + '="' + b + '"'
                            }), e += '<embed src="' + g + '" type="application/x-shockwave-flash" width="100%" height="100%"' + h + "></embed></object>"
                    }
                    u(e) && e.parent().is(a.inner) || a.inner.append(e);
                    b.trigger("beforeShow");
                    a.inner.css("overflow", "yes" === l ? "scroll" : "no" === l ? "hidden" : l);
                    b._setDimension();
                    b.reposition();
                    b.isOpen = !1;
                    b.coming = null;
                    b.bindEvents();
                    if (!b.isOpened) f(".fancybox-wrap").not(a.wrap).stop(!0).trigger("onReset").remove();
                    else if (d.prevMethod) b.transitions[d.prevMethod]();
                    b.transitions[b.isOpened ? a.nextMethod : a.openMethod]();
                    b._preloadImages()
                }
        },
        _setDimension: function() {
            var a = b.getViewport(),
                d = 0,
                e = !1,
                c = !1,
                e = b.wrap,
                l = b.skin,
                g = b.inner,
                h = b.current,
                c = h.width,
                k = h.height,
                n = h.minWidth,
                v = h.minHeight,
                p = h.maxWidth,
                q = h.maxHeight,
                t = h.scrolling,
                r = h.scrollOutside ? h.scrollbarWidth : 0,
                y = h.margin,
                z = m(y[1] + y[3]),
                s = m(y[0] + y[2]),
                w, A, u, D, B, G, C, E, I;
            e.add(l).add(g).width("auto").height("auto").removeClass("fancybox-tmp");
            y = m(l.outerWidth(!0) - l.width());
            w = m(l.outerHeight(!0) - l.height());
            A = z + y;
            u = s + w;
            D = F(c) ? (a.w - A) * m(c) / 100 : c;
            B = F(k) ? (a.h - u) * m(k) / 100 : k;
            if ("iframe" === h.type) {
                if (I = h.content, h.autoHeight && 1 === I.data("ready")) try {
                    I[0].contentWindow.document.location && (g.width(D).height(9999), G = I.contents().find("body"), r && G.css("overflow-x",
                        "hidden"), B = G.outerHeight(!0))
                } catch (H) {}
            } else if (h.autoWidth || h.autoHeight) g.addClass("fancybox-tmp"), h.autoWidth || g.width(D), h.autoHeight || g.height(B), h.autoWidth && (D = g.width()), h.autoHeight && (B = g.height()), g.removeClass("fancybox-tmp");
            c = m(D);
            k = m(B);
            E = D / B;
            n = m(F(n) ? m(n, "w") - A : n);
            p = m(F(p) ? m(p, "w") - A : p);
            v = m(F(v) ? m(v, "h") - u : v);
            q = m(F(q) ? m(q, "h") - u : q);
            G = p;
            C = q;
            h.fitToView && (p = Math.min(a.w - A, p), q = Math.min(a.h - u, q));
            A = a.w - z;
            s = a.h - s;
            h.aspectRatio ? (c > p && (c = p, k = m(c / E)), k > q && (k = q, c = m(k * E)), c < n && (c = n, k = m(c /
                E)), k < v && (k = v, c = m(k * E))) : (c = Math.max(n, Math.min(c, p)), h.autoHeight && "iframe" !== h.type && (g.width(c), k = g.height()), k = Math.max(v, Math.min(k, q)));
            if (h.fitToView)
                if (g.width(c).height(k), e.width(c + y), a = e.width(), z = e.height(), h.aspectRatio)
                    for (;
                        (a > A || z > s) && c > n && k > v && !(19 < d++);) k = Math.max(v, Math.min(q, k - 10)), c = m(k * E), c < n && (c = n, k = m(c / E)), c > p && (c = p, k = m(c / E)), g.width(c).height(k), e.width(c + y), a = e.width(), z = e.height();
                else c = Math.max(n, Math.min(c, c - (a - A))), k = Math.max(v, Math.min(k, k - (z - s)));
            r && "auto" === t && k < B &&
                c + y + r < A && (c += r);
            g.width(c).height(k);
            e.width(c + y);
            a = e.width();
            z = e.height();
            e = (a > A || z > s) && c > n && k > v;
            c = h.aspectRatio ? c < G && k < C && c < D && k < B : (c < G || k < C) && (c < D || k < B);
            f.extend(h, {
                dim: {
                    width: x(a),
                    height: x(z)
                },
                origWidth: D,
                origHeight: B,
                canShrink: e,
                canExpand: c,
                wPadding: y,
                hPadding: w,
                wrapSpace: z - l.outerHeight(!0),
                skinSpace: l.height() - k
            });
            !I && h.autoHeight && k > v && k < q && !c && g.height("auto")
        },
        _getPosition: function(a) {
            var d = b.current,
                e = b.getViewport(),
                c = d.margin,
                f = b.wrap.width() + c[1] + c[3],
                g = b.wrap.height() + c[0] + c[2],
                c = {
                    position: "absolute",
                    top: c[0],
                    left: c[3]
                };
            d.autoCenter && d.fixed && !a && g <= e.h && f <= e.w ? c.position = "fixed" : d.locked || (c.top += e.y, c.left += e.x);
            c.top = x(Math.max(c.top, c.top + (e.h - g) * d.topRatio));
            c.left = x(Math.max(c.left, c.left + (e.w - f) * d.leftRatio));
            return c
        },
        _afterZoomIn: function() {
            var a = b.current;
            a && ((b.isOpen = b.isOpened = !0, b.wrap.css("overflow", "visible").addClass("fancybox-opened"), b.update(), (a.closeClick || a.nextClick && 1 < b.group.length) && b.inner.css("cursor", "pointer").bind("click.fb", function(d) {
                f(d.target).is("a") || f(d.target).parent().is("a") ||
                    (d.preventDefault(), b[a.closeClick ? "close" : "next"]())
            }), a.closeBtn && f(a.tpl.closeBtn).appendTo(b.skin).bind("click.fb", function(a) {
                a.preventDefault();
                b.close()
            }), a.arrows && 1 < b.group.length && ((a.loop || 0 < a.index) && f(a.tpl.prev).appendTo(b.outer).bind("click.fb", b.prev), (a.loop || a.index < b.group.length - 1) && f(a.tpl.next).appendTo(b.outer).bind("click.fb", b.next)), b.trigger("afterShow"), a.loop || a.index !== a.group.length - 1) ? b.opts.autoPlay && !b.player.isActive && (b.opts.autoPlay = !1, b.play(!0)) : b.play(!1))
        },
        _afterZoomOut: function(a) {
            a = a || b.current;
            f(".fancybox-wrap").trigger("onReset").remove();
            f.extend(b, {
                group: {},
                opts: {},
                router: !1,
                current: null,
                isActive: !1,
                isOpened: !1,
                isOpen: !1,
                isClosing: !1,
                wrap: null,
                skin: null,
                outer: null,
                inner: null
            });
            b.trigger("afterClose", a)
        }
    });
    b.transitions = {
        getOrigPosition: function() {
            var a = b.current,
                d = a.element,
                e = a.orig,
                c = {},
                f = 50,
                g = 50,
                h = a.hPadding,
                k = a.wPadding,
                n = b.getViewport();
            !e && a.isDom && d.is(":visible") && (e = d.find("img:first"), e.length || (e = d));
            u(e) ? (c = e.offset(), e.is("img") &&
                (f = e.outerWidth(), g = e.outerHeight())) : (c.top = n.y + (n.h - g) * a.topRatio, c.left = n.x + (n.w - f) * a.leftRatio);
            if ("fixed" === b.wrap.css("position") || a.locked) c.top -= n.y, c.left -= n.x;
            return c = {
                top: x(c.top - h * a.topRatio),
                left: x(c.left - k * a.leftRatio),
                width: x(f + k),
                height: x(g + h)
            }
        },
        step: function(a, d) {
            var e, c, f = d.prop;
            c = b.current;
            var g = c.wrapSpace,
                h = c.skinSpace;
            if ("width" === f || "height" === f) e = d.end === d.start ? 1 : (a - d.start) / (d.end - d.start), b.isClosing && (e = 1 - e), c = "width" === f ? c.wPadding : c.hPadding, c = a - c, b.skin[f](m("width" ===
                f ? c : c - g * e)), b.inner[f](m("width" === f ? c : c - g * e - h * e))
        },
        zoomIn: function() {
            var a = b.current,
                d = a.pos,
                e = a.openEffect,
                c = "elastic" === e,
                l = f.extend({
                    opacity: 1
                }, d);
            delete l.position;
            c ? (d = this.getOrigPosition(), a.openOpacity && (d.opacity = 0.1)) : "fade" === e && (d.opacity = 0.1);
            b.wrap.css(d).animate(l, {
                duration: "none" === e ? 0 : a.openSpeed,
                easing: a.openEasing,
                step: c ? this.step : null,
                complete: b._afterZoomIn
            })
        },
        zoomOut: function() {
            var a = b.current,
                d = a.closeEffect,
                e = "elastic" === d,
                c = {
                    opacity: 0.1
                };
            e && (c = this.getOrigPosition(), a.closeOpacity &&
                (c.opacity = 0.1));
            b.wrap.animate(c, {
                duration: "none" === d ? 0 : a.closeSpeed,
                easing: a.closeEasing,
                step: e ? this.step : null,
                complete: b._afterZoomOut
            })
        },
        changeIn: function() {
            var a = b.current,
                d = a.nextEffect,
                e = a.pos,
                c = {
                    opacity: 1
                },
                f = b.direction,
                g;
            e.opacity = 0.1;
            "elastic" === d && (g = "down" === f || "up" === f ? "top" : "left", "down" === f || "right" === f ? (e[g] = x(m(e[g]) - 200), c[g] = "+=200px") : (e[g] = x(m(e[g]) + 200), c[g] = "-=200px"));
            "none" === d ? b._afterZoomIn() : b.wrap.css(e).animate(c, {
                duration: a.nextSpeed,
                easing: a.nextEasing,
                complete: b._afterZoomIn
            })
        },
        changeOut: function() {
            var a = b.previous,
                d = a.prevEffect,
                e = {
                    opacity: 0.1
                },
                c = b.direction;
            "elastic" === d && (e["down" === c || "up" === c ? "top" : "left"] = ("up" === c || "left" === c ? "-" : "+") + "=200px");
            a.wrap.animate(e, {
                duration: "none" === d ? 0 : a.prevSpeed,
                easing: a.prevEasing,
                complete: function() {
                    f(this).trigger("onReset").remove()
                }
            })
        }
    };
    b.helpers.overlay = {
        defaults: {
            closeClick: !0,
            speedOut: 200,
            showEarly: !0,
            css: {},
            locked: !t,
            fixed: !0
        },
        overlay: null,
        fixed: !1,
        el: f("html"),
        create: function(a) {
            var d;
            a = f.extend({}, this.defaults, a);
            this.overlay &&
                this.close();
            d = b.coming ? b.coming.parent : a.parent;
            this.overlay = f('<div class="fancybox-overlay"></div>').appendTo(d && d.lenth ? d : "body");
            this.fixed = !1;
            a.fixed && b.defaults.fixed && (this.overlay.addClass("fancybox-overlay-fixed"), this.fixed = !0)
        },
        open: function(a) {
            var d = this;
            a = f.extend({}, this.defaults, a);
            this.overlay ? this.overlay.unbind(".overlay").width("auto").height("auto") : this.create(a);
            this.fixed || (q.bind("resize.overlay", f.proxy(this.update, this)), this.update());
            a.closeClick && this.overlay.bind("click.overlay",
                function(a) {
                    if (f(a.target).hasClass("fancybox-overlay")) return b.isActive ? b.close() : d.close(), !1
                });
            this.overlay.css(a.css).show()
        },
        close: function() {
            q.unbind("resize.overlay");
            this.el.hasClass("fancybox-lock") && (f(".fancybox-margin").removeClass("fancybox-margin"), this.el.removeClass("fancybox-lock"), q.scrollTop(this.scrollV).scrollLeft(this.scrollH));
            f(".fancybox-overlay").remove().hide();
            f.extend(this, {
                overlay: null,
                fixed: !1
            })
        },
        update: function() {
            var a = "100%",
                b;
            this.overlay.width(a).height("100%");
            J ? (b = Math.max(H.documentElement.offsetWidth, H.body.offsetWidth), p.width() > b && (a = p.width())) : p.width() > q.width() && (a = p.width());
            this.overlay.width(a).height(p.height())
        },
        onReady: function(a, b) {
            var e = this.overlay;
            f(".fancybox-overlay").stop(!0, !0);
            e || this.create(a);
            a.locked && this.fixed && b.fixed && (b.locked = this.overlay.append(b.wrap), b.fixed = !1);
            !0 === a.showEarly && this.beforeShow.apply(this, arguments)
        },
        beforeShow: function(a, b) {
            b.locked && !this.el.hasClass("fancybox-lock") && (!1 !== this.fixPosition && f("*").filter(function() {
                return "fixed" ===
                    f(this).css("position") && !f(this).hasClass("fancybox-overlay") && !f(this).hasClass("fancybox-wrap")
            }).addClass("fancybox-margin"), this.el.addClass("fancybox-margin"), this.scrollV = q.scrollTop(), this.scrollH = q.scrollLeft(), this.el.addClass("fancybox-lock"), q.scrollTop(this.scrollV).scrollLeft(this.scrollH));
            this.open(a)
        },
        onUpdate: function() {
            this.fixed || this.update()
        },
        afterClose: function(a) {
            this.overlay && !b.coming && this.overlay.fadeOut(a.speedOut, f.proxy(this.close, this))
        }
    };
    b.helpers.title = {
        defaults: {
            type: "float",
            position: "bottom"
        },
        beforeShow: function(a) {
            var d = b.current,
                e = d.title,
                c = a.type;
            f.isFunction(e) && (e = e.call(d.element, d));
            if (r(e) && "" !== f.trim(e)) {
                d = f('<div class="fancybox-title fancybox-title-' + c + '-wrap">' + e + "</div>");
                switch (c) {
                    case "inside":
                        c = b.skin;
                        break;
                    case "outside":
                        c = b.wrap;
                        break;
                    case "over":
                        c = b.inner;
                        break;
                    default:
                        c = b.skin, d.appendTo("body"), J && d.width(d.width()), d.wrapInner('<span class="child"></span>'), b.current.margin[2] += Math.abs(m(d.css("margin-bottom")))
                }
                d["top" === a.position ? "prependTo" :
                    "appendTo"](c)
            }
        }
    };
    f.fn.fancybox = function(a) {
        var d, e = f(this),
            c = this.selector || "",
            l = function(g) {
                var h = f(this).blur(),
                    k = d,
                    l, m;
                g.ctrlKey || g.altKey || g.shiftKey || g.metaKey || h.is(".fancybox-wrap") || (l = a.groupAttr || "data-fancybox-group", m = h.attr(l), m || (l = "rel", m = h.get(0)[l]), m && "" !== m && "nofollow" !== m && (h = c.length ? f(c) : e, h = h.filter("[" + l + '="' + m + '"]'), k = h.index(this)), a.index = k, !1 !== b.open(h, a) && g.preventDefault())
            };
        a = a || {};
        d = a.index || 0;
        c && !1 !== a.live ? p.undelegate(c, "click.fb-start").delegate(c + ":not('.fancybox-item, .fancybox-nav')",
            "click.fb-start", l) : e.unbind("click.fb-start").bind("click.fb-start", l);
        this.filter("[data-fancybox-start=1]").trigger("click");
        return this
    };
    p.ready(function() {
        var a, d;
        f.scrollbarWidth === w && (f.scrollbarWidth = function() {
            var a = f('<div style="width:50px;height:50px;overflow:auto"><div/></div>').appendTo("body"),
                b = a.children(),
                b = b.innerWidth() - b.height(99).innerWidth();
            a.remove();
            return b
        });
        f.support.fixedPosition === w && (f.support.fixedPosition = function() {
            var a = f('<div style="position:fixed;top:20px;"></div>').appendTo("body"),
                b = 20 === a[0].offsetTop || 15 === a[0].offsetTop;
            a.remove();
            return b
        }());
        f.extend(b.defaults, {
            scrollbarWidth: f.scrollbarWidth(),
            fixed: f.support.fixedPosition,
            parent: f("body")
        });
        a = f(s).width();
        K.addClass("fancybox-lock-test");
        d = f(s).width();
        K.removeClass("fancybox-lock-test");
        f("<style type='text/css'>.fancybox-margin{margin-right:" + (d - a) + "px;}</style>").appendTo("head")
    })
})(window, document, jQuery);






/*!
 * Media helper for fancyBox
 * version: 1.0.6 (Fri, 14 Jun 2013)
 * @requires fancyBox v2.0 or later
 *
 * Usage:
 *     $(".fancybox").fancybox({
 *         helpers : {
 *             media: true
 *         }
 *     });
 *
 * Set custom URL parameters:
 *     $(".fancybox").fancybox({
 *         helpers : {
 *             media: {
 *                 youtube : {
 *                     params : {
 *                         autoplay : 0
 *                     }
 *                 }
 *             }
 *         }
 *     });
 *
 * Or:
 *     $(".fancybox").fancybox({,
 *         helpers : {
 *             media: true
 *         },
 *         youtube : {
 *             autoplay: 0
 *         }
 *     });
 *
 *  Supports:
 *
 *      Youtube
 *          http://www.youtube.com/watch?v=opj24KnzrWo
 *          http://www.youtube.com/embed/opj24KnzrWo
 *          http://youtu.be/opj24KnzrWo
 *          http://www.youtube-nocookie.com/embed/opj24KnzrWo
 *      Vimeo
 *          http://vimeo.com/40648169
 *          http://vimeo.com/channels/staffpicks/38843628
 *          http://vimeo.com/groups/surrealism/videos/36516384
 *          http://player.vimeo.com/video/45074303
 *      Metacafe
 *          http://www.metacafe.com/watch/7635964/dr_seuss_the_lorax_movie_trailer/
 *          http://www.metacafe.com/watch/7635964/
 *      Dailymotion
 *          http://www.dailymotion.com/video/xoytqh_dr-seuss-the-lorax-premiere_people
 *      Twitvid
 *          http://twitvid.com/QY7MD
 *      Twitpic
 *          http://twitpic.com/7p93st
 *      Instagram
 *          http://instagr.am/p/IejkuUGxQn/
 *          http://instagram.com/p/IejkuUGxQn/
 *      Google maps
 *          http://maps.google.com/maps?q=Eiffel+Tower,+Avenue+Gustave+Eiffel,+Paris,+France&t=h&z=17
 *          http://maps.google.com/?ll=48.857995,2.294297&spn=0.007666,0.021136&t=m&z=16
 *          http://maps.google.com/?ll=48.859463,2.292626&spn=0.000965,0.002642&t=m&z=19&layer=c&cbll=48.859524,2.292532&panoid=YJ0lq28OOy3VT2IqIuVY0g&cbp=12,151.58,,0,-15.56
 */
(function ($) {
    "use strict";

    //Shortcut for fancyBox object
    var F = $.fancybox,
        format = function( url, rez, params ) {
            params = params || '';

            if ( $.type( params ) === "object" ) {
                params = $.param(params, true);
            }

            $.each(rez, function(key, value) {
                url = url.replace( '$' + key, value || '' );
            });

            if (params.length) {
                url += ( url.indexOf('?') > 0 ? '&' : '?' ) + params;
            }

            return url;
        };

    //Add helper object
    F.helpers.media = {
        defaults : {
            youtube : {
                matcher : /(youtube\.com|youtu\.be|youtube-nocookie\.com)\/(watch\?v=|v\/|u\/|embed\/?)?(videoseries\?list=(.*)|[\w-]{11}|\?listType=(.*)&list=(.*)).*/i,
                params  : {
                    autoplay    : 1,
                    autohide    : 1,
                    fs          : 1,
                    rel         : 0,
                    hd          : 1,
                    wmode       : 'opaque',
                    enablejsapi : 1
                },
                type : 'iframe',
                url  : '//www.youtube.com/embed/$3'
            },
            vimeo : {
                matcher : /(?:vimeo(?:pro)?.com)\/(?:[^\d]+)?(\d+)(?:.*)/,
                params  : {
                    autoplay      : 1,
                    hd            : 1,
                    show_title    : 1,
                    show_byline   : 1,
                    show_portrait : 0,
                    fullscreen    : 1
                },
                type : 'iframe',
                url  : '//player.vimeo.com/video/$1'
            },
            metacafe : {
                matcher : /metacafe.com\/(?:watch|fplayer)\/([\w\-]{1,10})/,
                params  : {
                    autoPlay : 'yes'
                },
                type : 'swf',
                url  : function( rez, params, obj ) {
                    obj.swf.flashVars = 'playerVars=' + $.param( params, true );

                    return '//www.metacafe.com/fplayer/' + rez[1] + '/.swf';
                }
            },
            dailymotion : {
                matcher : /dailymotion.com\/video\/(.*)\/?(.*)/,
                params  : {
                    additionalInfos : 0,
                    autoStart : 1
                },
                type : 'swf',
                url  : '//www.dailymotion.com/swf/video/$1'
            },
            twitvid : {
                matcher : /twitvid\.com\/([a-zA-Z0-9_\-\?\=]+)/i,
                params  : {
                    autoplay : 0
                },
                type : 'iframe',
                url  : '//www.twitvid.com/embed.php?guid=$1'
            },
            twitpic : {
                matcher : /twitpic\.com\/(?!(?:place|photos|events)\/)([a-zA-Z0-9\?\=\-]+)/i,
                type : 'image',
                url  : '//twitpic.com/show/full/$1/'
            },
            instagram : {
                matcher : /(instagr\.am|instagram\.com)\/p\/([a-zA-Z0-9_\-]+)\/?/i,
                type : 'image',
                url  : '//$1/p/$2/media/?size=l'
            },
            google_maps : {
                matcher : /maps\.google\.([a-z]{2,3}(\.[a-z]{2})?)\/(\?ll=|maps\?)(.*)/i,
                type : 'iframe',
                url  : function( rez ) {
                    return '//maps.google.' + rez[1] + '/' + rez[3] + '' + rez[4] + '&output=' + (rez[4].indexOf('layer=c') > 0 ? 'svembed' : 'embed');
                }
            }
        },

        beforeLoad : function(opts, obj) {
            var url   = obj.href || '',
                type  = false,
                what,
                item,
                rez,
                params;

            for (what in opts) {
                if (opts.hasOwnProperty(what)) {
                    item = opts[ what ];
                    rez  = url.match( item.matcher );

                    if (rez) {
                        type   = item.type;
                        params = $.extend(true, {}, item.params, obj[ what ] || ($.isPlainObject(opts[ what ]) ? opts[ what ].params : null));

                        url = $.type( item.url ) === "function" ? item.url.call( this, rez, params, obj ) : format( item.url, rez, params );

                        break;
                    }
                }
            }

            if (type) {
                obj.href = url;
                obj.type = type;

                obj.autoHeight = false;
            }
        }
    };

}(jQuery));
;
(function ($, window, document, undefined) {

  var pluginName = "MegaMenu",
    defaults = {
      propertyName: "value"
    };
  var DELAY = 250;

  // the list of menus
  var menus = [];

  function CustomMenu(element, options) {
    this.element = element;

    this.options = $.extend({}, defaults, options);

    this._defaults = defaults;
    this._name = pluginName;

    this.init();
  }

  CustomMenu.prototype = {
    isOpen: false,
    timeout: null,
    init: function () {

      var that = this;

      $(this).each(function(index, menu) {
        that.node = menu.element; 
        that.addListeners(menu.element);

        var $menu = $(menu.element);
        $menu.addClass("dropdownJavascript");
        menus.push(menu.element);

        $menu.find('ul > li').each(function(index, submenu) {
          if ($(submenu).find('ul').length > 0 ) {
            $(submenu).addClass('with-menu');
          }
        });
      });
    },
    addListeners: function(menu) {
      var that = this;
      $(menu).mouseover(function(e) {
        that.handleMouseOver.call(that, e);
      }).mouseout(function(e) {
          that.handleMouseOut.call(that, e);
        });
    },
    handleMouseOver: function (e) {
      var that = this;
      // clear the timeout
      this.clearTimeout();

      // find the parent list item
      //var item = ('target' in e ? e.target : e.srcElement);
      var item = e.target || e.srcElement;
      while (item.nodeName != 'LI' && item != this.node) {
        item = item.parentNode;
      }

      // if the target is within a list item, set the timeout
      if (item.nodeName == 'LI') {
        this.toOpen = item;
        this.timeout = setTimeout(function() {
          that.open.call(that);
        }, this.options.delay);
      }

    },
    handleMouseOut: function () {
      var that = this;
      // clear the timeout
      this.clearTimeout();

      this.timeout = setTimeout(function() {
        that.close.call(that);
      }, this.options.delay);

    },
    clearTimeout: function () {

      // clear the timeout
      if (this.timeout) {
        clearTimeout(this.timeout);
        this.timeout = null;
      }

    },
    open: function () {

      var that = this;
      // store that the menu is open
      this.isOpen = true;

      // loop over the list items with the same parent
      var items = $(this.toOpen).parent().children('li');
      $(items).each(function(index, item) {
        $(item).find("ul").each(function(index, submenu) {
          if (item != that.toOpen) {
            // close the submenu
            $(item).removeClass("dropdownOpen");
            that.close(item);

          } else if (!$(item).hasClass('dropdownOpen')) {

            // open the submenu
            //if ( !$(item).parents('li').hasClass('has-mega-menu') ) {
              $(item).addClass("dropdownOpen");
            //}


            // determine the location of the edges of the submenu
            var left = 0;
            var node = submenu;
            while (node) {
              //abs is because when you make menus right to left
              //the offsetLeft would be negative
              left += Math.abs(node.offsetLeft);
              node = node.offsetParent;
            }
            var right = left + submenu.offsetWidth;


            //We should refactor this code to execute only when menu is vertical
            var menuHeight = $(submenu).outerHeight();
            var parentTop = $(submenu).offset().top - $(window).scrollTop();
            var totalHeight = menuHeight + parentTop;
            var windowHeight = window.innerHeight;

           /* if (totalHeight > windowHeight) {
              var bestTop = (windowHeight - totalHeight) - 20;
              $(submenu).css('margin-top', bestTop + "px");
            }*/

            //remove any previous classes
            $(item).removeClass('dropdownRightToLeft');

            // move the submenu to the right of the item if appropriate
            if (left < 0) $(item).addClass('dropdownLeftToRight');

            // move the submenu to the left of the item if appropriate
            if (right > document.body.clientWidth) {
              $(item).addClass('dropdownRightToLeft');
            }

          }
        });
      });

    },


    close: function (node) {

      // if no node was specified, close all menus
      if (!node) {
        this.isOpen = false;
        node = this.node;
      }

      // loop over the items, closing their submenus
      $(node).find('li').each(function(index, item) {
        $(item).removeClass('dropdownOpen');
      });

    }
  };

  $.fn[pluginName] = function (options) {
    return this.each(function () {
      if (!$.data(this, "plugin_" + pluginName)) {
        $.data(this, "plugin_" + pluginName,
          new CustomMenu(this, options));
      }
    });
  };

})(jQuery, window, document);

/*!
 * modernizr v3.3.1
 * Build https://modernizr.com/download?-cssanimations-csstransitions-touchevents-domprefixes-prefixed-prefixes-setclasses-shiv-testallprops-testprop-teststyles-dontmin
 *
 * Copyright (c)
 *  Faruk Ates
 *  Paul Irish
 *  Alex Sexton
 *  Ryan Seddon
 *  Patrick Kettner
 *  Stu Cox
 *  Richard Herrera

 * MIT License
 */

/*
 * Modernizr tests which native CSS3 and HTML5 features are available in the
 * current UA and makes the results available to you in two ways: as properties on
 * a global `Modernizr` object, and as classes on the `<html>` element. This
 * information allows you to progressively enhance your pages with a granular level
 * of control over the experience.
*/

;(function(window, document, undefined){
  var classes = [];
  

  var tests = [];
  

  /**
   *
   * ModernizrProto is the constructor for Modernizr
   *
   * @class
   * @access public
   */

  var ModernizrProto = {
    // The current version, dummy
    _version: '3.3.1',

    // Any settings that don't work as separate modules
    // can go in here as configuration.
    _config: {
      'classPrefix': '',
      'enableClasses': true,
      'enableJSClass': true,
      'usePrefixes': true
    },

    // Queue of tests
    _q: [],

    // Stub these for people who are listening
    on: function(test, cb) {
      // I don't really think people should do this, but we can
      // safe guard it a bit.
      // -- NOTE:: this gets WAY overridden in src/addTest for actual async tests.
      // This is in case people listen to synchronous tests. I would leave it out,
      // but the code to *disallow* sync tests in the real version of this
      // function is actually larger than this.
      var self = this;
      setTimeout(function() {
        cb(self[test]);
      }, 0);
    },

    addTest: function(name, fn, options) {
      tests.push({name: name, fn: fn, options: options});
    },

    addAsyncTest: function(fn) {
      tests.push({name: null, fn: fn});
    }
  };

  

  // Fake some of Object.create so we can force non test results to be non "own" properties.
  var Modernizr = function() {};
  Modernizr.prototype = ModernizrProto;

  // Leak modernizr globally when you `require` it rather than force it here.
  // Overwrite name so constructor name is nicer :D
  Modernizr = new Modernizr();

  

  /**
   * List of property values to set for css tests. See ticket #21
   * http://git.io/vUGl4
   *
   * @memberof Modernizr
   * @name Modernizr._prefixes
   * @optionName Modernizr._prefixes
   * @optionProp prefixes
   * @access public
   * @example
   *
   * Modernizr._prefixes is the internal list of prefixes that we test against
   * inside of things like [prefixed](#modernizr-prefixed) and [prefixedCSS](#-code-modernizr-prefixedcss). It is simply
   * an array of kebab-case vendor prefixes you can use within your code.
   *
   * Some common use cases include
   *
   * Generating all possible prefixed version of a CSS property
   * ```js
   * var rule = Modernizr._prefixes.join('transform: rotate(20deg); ');
   *
   * rule === 'transform: rotate(20deg); webkit-transform: rotate(20deg); moz-transform: rotate(20deg); o-transform: rotate(20deg); ms-transform: rotate(20deg);'
   * ```
   *
   * Generating all possible prefixed version of a CSS value
   * ```js
   * rule = 'display:' +  Modernizr._prefixes.join('flex; display:') + 'flex';
   *
   * rule === 'display:flex; display:-webkit-flex; display:-moz-flex; display:-o-flex; display:-ms-flex; display:flex'
   * ```
   */

  // we use ['',''] rather than an empty array in order to allow a pattern of .`join()`ing prefixes to test
  // values in feature detects to continue to work
  var prefixes = (ModernizrProto._config.usePrefixes ? ' -webkit- -moz- -o- -ms- '.split(' ') : ['','']);

  // expose these for the plugin API. Look in the source for how to join() them against your input
  ModernizrProto._prefixes = prefixes;

  

  /**
   * is returns a boolean if the typeof an obj is exactly type.
   *
   * @access private
   * @function is
   * @param {*} obj - A thing we want to check the type of
   * @param {string} type - A string to compare the typeof against
   * @returns {boolean}
   */

  function is(obj, type) {
    return typeof obj === type;
  }
  ;

  /**
   * Run through all tests and detect their support in the current UA.
   *
   * @access private
   */

  function testRunner() {
    var featureNames;
    var feature;
    var aliasIdx;
    var result;
    var nameIdx;
    var featureName;
    var featureNameSplit;

    for (var featureIdx in tests) {
      if (tests.hasOwnProperty(featureIdx)) {
        featureNames = [];
        feature = tests[featureIdx];
        // run the test, throw the return value into the Modernizr,
        // then based on that boolean, define an appropriate className
        // and push it into an array of classes we'll join later.
        //
        // If there is no name, it's an 'async' test that is run,
        // but not directly added to the object. That should
        // be done with a post-run addTest call.
        if (feature.name) {
          featureNames.push(feature.name.toLowerCase());

          if (feature.options && feature.options.aliases && feature.options.aliases.length) {
            // Add all the aliases into the names list
            for (aliasIdx = 0; aliasIdx < feature.options.aliases.length; aliasIdx++) {
              featureNames.push(feature.options.aliases[aliasIdx].toLowerCase());
            }
          }
        }

        // Run the test, or use the raw value if it's not a function
        result = is(feature.fn, 'function') ? feature.fn() : feature.fn;


        // Set each of the names on the Modernizr object
        for (nameIdx = 0; nameIdx < featureNames.length; nameIdx++) {
          featureName = featureNames[nameIdx];
          // Support dot properties as sub tests. We don't do checking to make sure
          // that the implied parent tests have been added. You must call them in
          // order (either in the test, or make the parent test a dependency).
          //
          // Cap it to TWO to make the logic simple and because who needs that kind of subtesting
          // hashtag famous last words
          featureNameSplit = featureName.split('.');

          if (featureNameSplit.length === 1) {
            Modernizr[featureNameSplit[0]] = result;
          } else {
            // cast to a Boolean, if not one already
            /* jshint -W053 */
            if (Modernizr[featureNameSplit[0]] && !(Modernizr[featureNameSplit[0]] instanceof Boolean)) {
              Modernizr[featureNameSplit[0]] = new Boolean(Modernizr[featureNameSplit[0]]);
            }

            Modernizr[featureNameSplit[0]][featureNameSplit[1]] = result;
          }

          classes.push((result ? '' : 'no-') + featureNameSplit.join('-'));
        }
      }
    }
  }
  ;

  /**
   * docElement is a convenience wrapper to grab the root element of the document
   *
   * @access private
   * @returns {HTMLElement|SVGElement} The root element of the document
   */

  var docElement = document.documentElement;
  

  /**
   * A convenience helper to check if the document we are running in is an SVG document
   *
   * @access private
   * @returns {boolean}
   */

  var isSVG = docElement.nodeName.toLowerCase() === 'svg';
  

  /**
   * setClasses takes an array of class names and adds them to the root element
   *
   * @access private
   * @function setClasses
   * @param {string[]} classes - Array of class names
   */

  // Pass in an and array of class names, e.g.:
  //  ['no-webp', 'borderradius', ...]
  function setClasses(classes) {
    var className = docElement.className;
    var classPrefix = Modernizr._config.classPrefix || '';

    if (isSVG) {
      className = className.baseVal;
    }

    // Change `no-js` to `js` (independently of the `enableClasses` option)
    // Handle classPrefix on this too
    if (Modernizr._config.enableJSClass) {
      var reJS = new RegExp('(^|\\s)' + classPrefix + 'no-js(\\s|$)');
      className = className.replace(reJS, '$1' + classPrefix + 'js$2');
    }

    if (Modernizr._config.enableClasses) {
      // Add the new classes
      className += ' ' + classPrefix + classes.join(' ' + classPrefix);
      isSVG ? docElement.className.baseVal = className : docElement.className = className;
    }

  }

  ;

/**
  * @optionName html5shiv
  * @optionProp html5shiv
  */

  // Take the html5 variable out of the html5shiv scope so we can return it.
  var html5;
  if (!isSVG) {
    /**
     * @preserve HTML5 Shiv 3.7.3 | @afarkas @jdalton @jon_neal @rem | MIT/GPL2 Licensed
     */
    ;(function(window, document) {
      /*jshint evil:true */
      /** version */
      var version = '3.7.3';

      /** Preset options */
      var options = window.html5 || {};

      /** Used to skip problem elements */
      var reSkip = /^<|^(?:button|map|select|textarea|object|iframe|option|optgroup)$/i;

      /** Not all elements can be cloned in IE **/
      var saveClones = /^(?:a|b|code|div|fieldset|h1|h2|h3|h4|h5|h6|i|label|li|ol|p|q|span|strong|style|table|tbody|td|th|tr|ul)$/i;

      /** Detect whether the browser supports default html5 styles */
      var supportsHtml5Styles;

      /** Name of the expando, to work with multiple documents or to re-shiv one document */
      var expando = '_html5shiv';

      /** The id for the the documents expando */
      var expanID = 0;

      /** Cached data for each document */
      var expandoData = {};

      /** Detect whether the browser supports unknown elements */
      var supportsUnknownElements;

      (function() {
        try {
          var a = document.createElement('a');
          a.innerHTML = '<xyz></xyz>';
          //if the hidden property is implemented we can assume, that the browser supports basic HTML5 Styles
          supportsHtml5Styles = ('hidden' in a);

          supportsUnknownElements = a.childNodes.length == 1 || (function() {
            // assign a false positive if unable to shiv
            (document.createElement)('a');
            var frag = document.createDocumentFragment();
            return (
              typeof frag.cloneNode == 'undefined' ||
                typeof frag.createDocumentFragment == 'undefined' ||
                typeof frag.createElement == 'undefined'
            );
          }());
        } catch(e) {
          // assign a false positive if detection fails => unable to shiv
          supportsHtml5Styles = true;
          supportsUnknownElements = true;
        }

      }());

      /*--------------------------------------------------------------------------*/

      /**
       * Creates a style sheet with the given CSS text and adds it to the document.
       * @private
       * @param {Document} ownerDocument The document.
       * @param {String} cssText The CSS text.
       * @returns {StyleSheet} The style element.
       */
      function addStyleSheet(ownerDocument, cssText) {
        var p = ownerDocument.createElement('p'),
          parent = ownerDocument.getElementsByTagName('head')[0] || ownerDocument.documentElement;

        p.innerHTML = 'x<style>' + cssText + '</style>';
        return parent.insertBefore(p.lastChild, parent.firstChild);
      }

      /**
       * Returns the value of `html5.elements` as an array.
       * @private
       * @returns {Array} An array of shived element node names.
       */
      function getElements() {
        var elements = html5.elements;
        return typeof elements == 'string' ? elements.split(' ') : elements;
      }

      /**
       * Extends the built-in list of html5 elements
       * @memberOf html5
       * @param {String|Array} newElements whitespace separated list or array of new element names to shiv
       * @param {Document} ownerDocument The context document.
       */
      function addElements(newElements, ownerDocument) {
        var elements = html5.elements;
        if(typeof elements != 'string'){
          elements = elements.join(' ');
        }
        if(typeof newElements != 'string'){
          newElements = newElements.join(' ');
        }
        html5.elements = elements +' '+ newElements;
        shivDocument(ownerDocument);
      }

      /**
       * Returns the data associated to the given document
       * @private
       * @param {Document} ownerDocument The document.
       * @returns {Object} An object of data.
       */
      function getExpandoData(ownerDocument) {
        var data = expandoData[ownerDocument[expando]];
        if (!data) {
          data = {};
          expanID++;
          ownerDocument[expando] = expanID;
          expandoData[expanID] = data;
        }
        return data;
      }

      /**
       * returns a shived element for the given nodeName and document
       * @memberOf html5
       * @param {String} nodeName name of the element
       * @param {Document|DocumentFragment} ownerDocument The context document.
       * @returns {Object} The shived element.
       */
      function createElement(nodeName, ownerDocument, data){
        if (!ownerDocument) {
          ownerDocument = document;
        }
        if(supportsUnknownElements){
          return ownerDocument.createElement(nodeName);
        }
        if (!data) {
          data = getExpandoData(ownerDocument);
        }
        var node;

        if (data.cache[nodeName]) {
          node = data.cache[nodeName].cloneNode();
        } else if (saveClones.test(nodeName)) {
          node = (data.cache[nodeName] = data.createElem(nodeName)).cloneNode();
        } else {
          node = data.createElem(nodeName);
        }

        // Avoid adding some elements to fragments in IE < 9 because
        // * Attributes like `name` or `type` cannot be set/changed once an element
        //   is inserted into a document/fragment
        // * Link elements with `src` attributes that are inaccessible, as with
        //   a 403 response, will cause the tab/window to crash
        // * Script elements appended to fragments will execute when their `src`
        //   or `text` property is set
        return node.canHaveChildren && !reSkip.test(nodeName) && !node.tagUrn ? data.frag.appendChild(node) : node;
      }

      /**
       * returns a shived DocumentFragment for the given document
       * @memberOf html5
       * @param {Document} ownerDocument The context document.
       * @returns {Object} The shived DocumentFragment.
       */
      function createDocumentFragment(ownerDocument, data){
        if (!ownerDocument) {
          ownerDocument = document;
        }
        if(supportsUnknownElements){
          return ownerDocument.createDocumentFragment();
        }
        data = data || getExpandoData(ownerDocument);
        var clone = data.frag.cloneNode(),
          i = 0,
          elems = getElements(),
          l = elems.length;
        for(;i<l;i++){
          clone.createElement(elems[i]);
        }
        return clone;
      }

      /**
       * Shivs the `createElement` and `createDocumentFragment` methods of the document.
       * @private
       * @param {Document|DocumentFragment} ownerDocument The document.
       * @param {Object} data of the document.
       */
      function shivMethods(ownerDocument, data) {
        if (!data.cache) {
          data.cache = {};
          data.createElem = ownerDocument.createElement;
          data.createFrag = ownerDocument.createDocumentFragment;
          data.frag = data.createFrag();
        }


        ownerDocument.createElement = function(nodeName) {
          //abort shiv
          if (!html5.shivMethods) {
            return data.createElem(nodeName);
          }
          return createElement(nodeName, ownerDocument, data);
        };

        ownerDocument.createDocumentFragment = Function('h,f', 'return function(){' +
                                                        'var n=f.cloneNode(),c=n.createElement;' +
                                                        'h.shivMethods&&(' +
                                                        // unroll the `createElement` calls
                                                        getElements().join().replace(/[\w\-:]+/g, function(nodeName) {
          data.createElem(nodeName);
          data.frag.createElement(nodeName);
          return 'c("' + nodeName + '")';
        }) +
          ');return n}'
                                                       )(html5, data.frag);
      }

      /*--------------------------------------------------------------------------*/

      /**
       * Shivs the given document.
       * @memberOf html5
       * @param {Document} ownerDocument The document to shiv.
       * @returns {Document} The shived document.
       */
      function shivDocument(ownerDocument) {
        if (!ownerDocument) {
          ownerDocument = document;
        }
        var data = getExpandoData(ownerDocument);

        if (html5.shivCSS && !supportsHtml5Styles && !data.hasCSS) {
          data.hasCSS = !!addStyleSheet(ownerDocument,
                                        // corrects block display not defined in IE6/7/8/9
                                        'article,aside,dialog,figcaption,figure,footer,header,hgroup,main,nav,section{display:block}' +
                                        // adds styling not present in IE6/7/8/9
                                        'mark{background:#FF0;color:#000}' +
                                        // hides non-rendered elements
                                        'template{display:none}'
                                       );
        }
        if (!supportsUnknownElements) {
          shivMethods(ownerDocument, data);
        }
        return ownerDocument;
      }

      /*--------------------------------------------------------------------------*/

      /**
       * The `html5` object is exposed so that more elements can be shived and
       * existing shiving can be detected on iframes.
       * @type Object
       * @example
       *
       * // options can be changed before the script is included
       * html5 = { 'elements': 'mark section', 'shivCSS': false, 'shivMethods': false };
       */
      var html5 = {

        /**
         * An array or space separated string of node names of the elements to shiv.
         * @memberOf html5
         * @type Array|String
         */
        'elements': options.elements || 'abbr article aside audio bdi canvas data datalist details dialog figcaption figure footer header hgroup main mark meter nav output picture progress section summary template time video',

        /**
         * current version of html5shiv
         */
        'version': version,

        /**
         * A flag to indicate that the HTML5 style sheet should be inserted.
         * @memberOf html5
         * @type Boolean
         */
        'shivCSS': (options.shivCSS !== false),

        /**
         * Is equal to true if a browser supports creating unknown/HTML5 elements
         * @memberOf html5
         * @type boolean
         */
        'supportsUnknownElements': supportsUnknownElements,

        /**
         * A flag to indicate that the document's `createElement` and `createDocumentFragment`
         * methods should be overwritten.
         * @memberOf html5
         * @type Boolean
         */
        'shivMethods': (options.shivMethods !== false),

        /**
         * A string to describe the type of `html5` object ("default" or "default print").
         * @memberOf html5
         * @type String
         */
        'type': 'default',

        // shivs the document according to the specified `html5` object options
        'shivDocument': shivDocument,

        //creates a shived element
        createElement: createElement,

        //creates a shived documentFragment
        createDocumentFragment: createDocumentFragment,

        //extends list of elements
        addElements: addElements
      };

      /*--------------------------------------------------------------------------*/

      // expose html5
      window.html5 = html5;

      // shiv the document
      shivDocument(document);

      if(typeof module == 'object' && module.exports){
        module.exports = html5;
      }

    }(typeof window !== "undefined" ? window : this, document));
  }
;

  /**
   * If the browsers follow the spec, then they would expose vendor-specific style as:
   *   elem.style.WebkitBorderRadius
   * instead of something like the following, which would be technically incorrect:
   *   elem.style.webkitBorderRadius

   * Webkit ghosts their properties in lowercase but Opera & Moz do not.
   * Microsoft uses a lowercase `ms` instead of the correct `Ms` in IE8+
   *   erik.eae.net/archives/2008/03/10/21.48.10/

   * More here: github.com/Modernizr/Modernizr/issues/issue/21
   *
   * @access private
   * @returns {string} The string representing the vendor-specific style properties
   */

  var omPrefixes = 'Moz O ms Webkit';
  

  /**
   * List of JavaScript DOM values used for tests
   *
   * @memberof Modernizr
   * @name Modernizr._domPrefixes
   * @optionName Modernizr._domPrefixes
   * @optionProp domPrefixes
   * @access public
   * @example
   *
   * Modernizr._domPrefixes is exactly the same as [_prefixes](#modernizr-_prefixes), but rather
   * than kebab-case properties, all properties are their Capitalized variant
   *
   * ```js
   * Modernizr._domPrefixes === [ "Moz", "O", "ms", "Webkit" ];
   * ```
   */

  var domPrefixes = (ModernizrProto._config.usePrefixes ? omPrefixes.toLowerCase().split(' ') : []);
  ModernizrProto._domPrefixes = domPrefixes;
  

  /**
   * cssToDOM takes a kebab-case string and converts it to camelCase
   * e.g. box-sizing -> boxSizing
   *
   * @access private
   * @function cssToDOM
   * @param {string} name - String name of kebab-case prop we want to convert
   * @returns {string} The camelCase version of the supplied name
   */

  function cssToDOM(name) {
    return name.replace(/([a-z])-([a-z])/g, function(str, m1, m2) {
      return m1 + m2.toUpperCase();
    }).replace(/^-/, '');
  }
  ;

  var cssomPrefixes = (ModernizrProto._config.usePrefixes ? omPrefixes.split(' ') : []);
  ModernizrProto._cssomPrefixes = cssomPrefixes;
  

  /**
   * atRule returns a given CSS property at-rule (eg @keyframes), possibly in
   * some prefixed form, or false, in the case of an unsupported rule
   *
   * @memberof Modernizr
   * @name Modernizr.atRule
   * @optionName Modernizr.atRule()
   * @optionProp atRule
   * @access public
   * @function atRule
   * @param {string} prop - String name of the @-rule to test for
   * @returns {string|boolean} The string representing the (possibly prefixed)
   * valid version of the @-rule, or `false` when it is unsupported.
   * @example
   * ```js
   *  var keyframes = Modernizr.atRule('@keyframes');
   *
   *  if (keyframes) {
   *    // keyframes are supported
   *    // could be `@-webkit-keyframes` or `@keyframes`
   *  } else {
   *    // keyframes === `false`
   *  }
   * ```
   *
   */

  var atRule = function(prop) {
    var length = prefixes.length;
    var cssrule = window.CSSRule;
    var rule;

    if (typeof cssrule === 'undefined') {
      return undefined;
    }

    if (!prop) {
      return false;
    }

    // remove literal @ from beginning of provided property
    prop = prop.replace(/^@/, '');

    // CSSRules use underscores instead of dashes
    rule = prop.replace(/-/g, '_').toUpperCase() + '_RULE';

    if (rule in cssrule) {
      return '@' + prop;
    }

    for (var i = 0; i < length; i++) {
      // prefixes gives us something like -o-, and we want O_
      var prefix = prefixes[i];
      var thisRule = prefix.toUpperCase() + '_' + rule;

      if (thisRule in cssrule) {
        return '@-' + prefix.toLowerCase() + '-' + prop;
      }
    }

    return false;
  };

  ModernizrProto.atRule = atRule;

  


  /**
   * contains checks to see if a string contains another string
   *
   * @access private
   * @function contains
   * @param {string} str - The string we want to check for substrings
   * @param {string} substr - The substring we want to search the first string for
   * @returns {boolean}
   */

  function contains(str, substr) {
    return !!~('' + str).indexOf(substr);
  }

  ;

  /**
   * createElement is a convenience wrapper around document.createElement. Since we
   * use createElement all over the place, this allows for (slightly) smaller code
   * as well as abstracting away issues with creating elements in contexts other than
   * HTML documents (e.g. SVG documents).
   *
   * @access private
   * @function createElement
   * @returns {HTMLElement|SVGElement} An HTML or SVG element
   */

  function createElement() {
    if (typeof document.createElement !== 'function') {
      // This is the case in IE7, where the type of createElement is "object".
      // For this reason, we cannot call apply() as Object is not a Function.
      return document.createElement(arguments[0]);
    } else if (isSVG) {
      return document.createElementNS.call(document, 'http://www.w3.org/2000/svg', arguments[0]);
    } else {
      return document.createElement.apply(document, arguments);
    }
  }

  ;

  /**
   * getBody returns the body of a document, or an element that can stand in for
   * the body if a real body does not exist
   *
   * @access private
   * @function getBody
   * @returns {HTMLElement|SVGElement} Returns the real body of a document, or an
   * artificially created element that stands in for the body
   */

  function getBody() {
    // After page load injecting a fake body doesn't work so check if body exists
    var body = document.body;

    if (!body) {
      // Can't use the real body create a fake one.
      body = createElement(isSVG ? 'svg' : 'body');
      body.fake = true;
    }

    return body;
  }

  ;

  /**
   * injectElementWithStyles injects an element with style element and some CSS rules
   *
   * @access private
   * @function injectElementWithStyles
   * @param {string} rule - String representing a css rule
   * @param {function} callback - A function that is used to test the injected element
   * @param {number} [nodes] - An integer representing the number of additional nodes you want injected
   * @param {string[]} [testnames] - An array of strings that are used as ids for the additional nodes
   * @returns {boolean}
   */

  function injectElementWithStyles(rule, callback, nodes, testnames) {
    var mod = 'modernizr';
    var style;
    var ret;
    var node;
    var docOverflow;
    var div = createElement('div');
    var body = getBody();

    if (parseInt(nodes, 10)) {
      // In order not to give false positives we create a node for each test
      // This also allows the method to scale for unspecified uses
      while (nodes--) {
        node = createElement('div');
        node.id = testnames ? testnames[nodes] : mod + (nodes + 1);
        div.appendChild(node);
      }
    }

    style = createElement('style');
    style.type = 'text/css';
    style.id = 's' + mod;

    // IE6 will false positive on some tests due to the style element inside the test div somehow interfering offsetHeight, so insert it into body or fakebody.
    // Opera will act all quirky when injecting elements in documentElement when page is served as xml, needs fakebody too. #270
    (!body.fake ? div : body).appendChild(style);
    body.appendChild(div);

    if (style.styleSheet) {
      style.styleSheet.cssText = rule;
    } else {
      style.appendChild(document.createTextNode(rule));
    }
    div.id = mod;

    if (body.fake) {
      //avoid crashing IE8, if background image is used
      body.style.background = '';
      //Safari 5.13/5.1.4 OSX stops loading if ::-webkit-scrollbar is used and scrollbars are visible
      body.style.overflow = 'hidden';
      docOverflow = docElement.style.overflow;
      docElement.style.overflow = 'hidden';
      docElement.appendChild(body);
    }

    ret = callback(div, rule);
    // If this is done after page load we don't want to remove the body so check if body exists
    if (body.fake) {
      body.parentNode.removeChild(body);
      docElement.style.overflow = docOverflow;
      // Trigger layout so kinetic scrolling isn't disabled in iOS6+
      docElement.offsetHeight;
    } else {
      div.parentNode.removeChild(div);
    }

    return !!ret;

  }

  ;

  /**
   * testStyles injects an element with style element and some CSS rules
   *
   * @memberof Modernizr
   * @name Modernizr.testStyles
   * @optionName Modernizr.testStyles()
   * @optionProp testStyles
   * @access public
   * @function testStyles
   * @param {string} rule - String representing a css rule
   * @param {function} callback - A function that is used to test the injected element
   * @param {number} [nodes] - An integer representing the number of additional nodes you want injected
   * @param {string[]} [testnames] - An array of strings that are used as ids for the additional nodes
   * @returns {boolean}
   * @example
   *
   * `Modernizr.testStyles` takes a CSS rule and injects it onto the current page
   * along with (possibly multiple) DOM elements. This lets you check for features
   * that can not be detected by simply checking the [IDL](https://developer.mozilla.org/en-US/docs/Mozilla/Developer_guide/Interface_development_guide/IDL_interface_rules).
   *
   * ```js
   * Modernizr.testStyles('#modernizr { width: 9px; color: papayawhip; }', function(elem, rule) {
   *   // elem is the first DOM node in the page (by default #modernizr)
   *   // rule is the first argument you supplied - the CSS rule in string form
   *
   *   addTest('widthworks', elem.style.width === '9px')
   * });
   * ```
   *
   * If your test requires multiple nodes, you can include a third argument
   * indicating how many additional div elements to include on the page. The
   * additional nodes are injected as children of the `elem` that is returned as
   * the first argument to the callback.
   *
   * ```js
   * Modernizr.testStyles('#modernizr {width: 1px}; #modernizr2 {width: 2px}', function(elem) {
   *   document.getElementById('modernizr').style.width === '1px'; // true
   *   document.getElementById('modernizr2').style.width === '2px'; // true
   *   elem.firstChild === document.getElementById('modernizr2'); // true
   * }, 1);
   * ```
   *
   * By default, all of the additional elements have an ID of `modernizr[n]`, where
   * `n` is its index (e.g. the first additional, second overall is `#modernizr2`,
   * the second additional is `#modernizr3`, etc.).
   * If you want to have more meaningful IDs for your function, you can provide
   * them as the fourth argument, as an array of strings
   *
   * ```js
   * Modernizr.testStyles('#foo {width: 10px}; #bar {height: 20px}', function(elem) {
   *   elem.firstChild === document.getElementById('foo'); // true
   *   elem.lastChild === document.getElementById('bar'); // true
   * }, 2, ['foo', 'bar']);
   * ```
   *
   */

  var testStyles = ModernizrProto.testStyles = injectElementWithStyles;
  

  /**
   * fnBind is a super small [bind](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/bind) polyfill.
   *
   * @access private
   * @function fnBind
   * @param {function} fn - a function you want to change `this` reference to
   * @param {object} that - the `this` you want to call the function with
   * @returns {function} The wrapped version of the supplied function
   */

  function fnBind(fn, that) {
    return function() {
      return fn.apply(that, arguments);
    };
  }

  ;

  /**
   * testDOMProps is a generic DOM property test; if a browser supports
   *   a certain property, it won't return undefined for it.
   *
   * @access private
   * @function testDOMProps
   * @param {array.<string>} props - An array of properties to test for
   * @param {object} obj - An object or Element you want to use to test the parameters again
   * @param {boolean|object} elem - An Element to bind the property lookup again. Use `false` to prevent the check
   */
  function testDOMProps(props, obj, elem) {
    var item;

    for (var i in props) {
      if (props[i] in obj) {

        // return the property name as a string
        if (elem === false) {
          return props[i];
        }

        item = obj[props[i]];

        // let's bind a function
        if (is(item, 'function')) {
          // bind to obj unless overriden
          return fnBind(item, elem || obj);
        }

        // return the unbound function or obj or value
        return item;
      }
    }
    return false;
  }

  ;

  /**
   * Create our "modernizr" element that we do most feature tests on.
   *
   * @access private
   */

  var modElem = {
    elem: createElement('modernizr')
  };

  // Clean up this element
  Modernizr._q.push(function() {
    delete modElem.elem;
  });

  

  var mStyle = {
    style: modElem.elem.style
  };

  // kill ref for gc, must happen before mod.elem is removed, so we unshift on to
  // the front of the queue.
  Modernizr._q.unshift(function() {
    delete mStyle.style;
  });

  

  /**
   * domToCSS takes a camelCase string and converts it to kebab-case
   * e.g. boxSizing -> box-sizing
   *
   * @access private
   * @function domToCSS
   * @param {string} name - String name of camelCase prop we want to convert
   * @returns {string} The kebab-case version of the supplied name
   */

  function domToCSS(name) {
    return name.replace(/([A-Z])/g, function(str, m1) {
      return '-' + m1.toLowerCase();
    }).replace(/^ms-/, '-ms-');
  }
  ;

  /**
   * nativeTestProps allows for us to use native feature detection functionality if available.
   * some prefixed form, or false, in the case of an unsupported rule
   *
   * @access private
   * @function nativeTestProps
   * @param {array} props - An array of property names
   * @param {string} value - A string representing the value we want to check via @supports
   * @returns {boolean|undefined} A boolean when @supports exists, undefined otherwise
   */

  // Accepts a list of property names and a single value
  // Returns `undefined` if native detection not available
  function nativeTestProps(props, value) {
    var i = props.length;
    // Start with the JS API: http://www.w3.org/TR/css3-conditional/#the-css-interface
    if ('CSS' in window && 'supports' in window.CSS) {
      // Try every prefixed variant of the property
      while (i--) {
        if (window.CSS.supports(domToCSS(props[i]), value)) {
          return true;
        }
      }
      return false;
    }
    // Otherwise fall back to at-rule (for Opera 12.x)
    else if ('CSSSupportsRule' in window) {
      // Build a condition string for every prefixed variant
      var conditionText = [];
      while (i--) {
        conditionText.push('(' + domToCSS(props[i]) + ':' + value + ')');
      }
      conditionText = conditionText.join(' or ');
      return injectElementWithStyles('@supports (' + conditionText + ') { #modernizr { position: absolute; } }', function(node) {
        return getComputedStyle(node, null).position == 'absolute';
      });
    }
    return undefined;
  }
  ;

  // testProps is a generic CSS / DOM property test.

  // In testing support for a given CSS property, it's legit to test:
  //    `elem.style[styleName] !== undefined`
  // If the property is supported it will return an empty string,
  // if unsupported it will return undefined.

  // We'll take advantage of this quick test and skip setting a style
  // on our modernizr element, but instead just testing undefined vs
  // empty string.

  // Property names can be provided in either camelCase or kebab-case.

  function testProps(props, prefixed, value, skipValueTest) {
    skipValueTest = is(skipValueTest, 'undefined') ? false : skipValueTest;

    // Try native detect first
    if (!is(value, 'undefined')) {
      var result = nativeTestProps(props, value);
      if (!is(result, 'undefined')) {
        return result;
      }
    }

    // Otherwise do it properly
    var afterInit, i, propsLength, prop, before;

    // If we don't have a style element, that means we're running async or after
    // the core tests, so we'll need to create our own elements to use

    // inside of an SVG element, in certain browsers, the `style` element is only
    // defined for valid tags. Therefore, if `modernizr` does not have one, we
    // fall back to a less used element and hope for the best.
    // for strict XHTML browsers the hardly used samp element is used
    var elems = ['modernizr', 'tspan', 'samp'];
    while (!mStyle.style && elems.length) {
      afterInit = true;
      mStyle.modElem = createElement(elems.shift());
      mStyle.style = mStyle.modElem.style;
    }

    // Delete the objects if we created them.
    function cleanElems() {
      if (afterInit) {
        delete mStyle.style;
        delete mStyle.modElem;
      }
    }

    propsLength = props.length;
    for (i = 0; i < propsLength; i++) {
      prop = props[i];
      before = mStyle.style[prop];

      if (contains(prop, '-')) {
        prop = cssToDOM(prop);
      }

      if (mStyle.style[prop] !== undefined) {

        // If value to test has been passed in, do a set-and-check test.
        // 0 (integer) is a valid property value, so check that `value` isn't
        // undefined, rather than just checking it's truthy.
        if (!skipValueTest && !is(value, 'undefined')) {

          // Needs a try catch block because of old IE. This is slow, but will
          // be avoided in most cases because `skipValueTest` will be used.
          try {
            mStyle.style[prop] = value;
          } catch (e) {}

          // If the property value has changed, we assume the value used is
          // supported. If `value` is empty string, it'll fail here (because
          // it hasn't changed), which matches how browsers have implemented
          // CSS.supports()
          if (mStyle.style[prop] != before) {
            cleanElems();
            return prefixed == 'pfx' ? prop : true;
          }
        }
        // Otherwise just return true, or the property name if this is a
        // `prefixed()` call
        else {
          cleanElems();
          return prefixed == 'pfx' ? prop : true;
        }
      }
    }
    cleanElems();
    return false;
  }

  ;

  /**
   * testProp() investigates whether a given style property is recognized
   * Property names can be provided in either camelCase or kebab-case.
   *
   * @memberof Modernizr
   * @name Modernizr.testProp
   * @access public
   * @optionName Modernizr.testProp()
   * @optionProp testProp
   * @function testProp
   * @param {string} prop - Name of the CSS property to check
   * @param {string} [value] - Name of the CSS value to check
   * @param {boolean} [useValue] - Whether or not to check the value if @supports isn't supported
   * @returns {boolean}
   * @example
   *
   * Just like [testAllProps](#modernizr-testallprops), only it does not check any vendor prefixed
   * version of the string.
   *
   * Note that the property name must be provided in camelCase (e.g. boxSizing not box-sizing)
   *
   * ```js
   * Modernizr.testProp('pointerEvents')  // true
   * ```
   *
   * You can also provide a value as an optional second argument to check if a
   * specific value is supported
   *
   * ```js
   * Modernizr.testProp('pointerEvents', 'none') // true
   * Modernizr.testProp('pointerEvents', 'penguin') // false
   * ```
   */

  var testProp = ModernizrProto.testProp = function(prop, value, useValue) {
    return testProps([prop], undefined, value, useValue);
  };
  

  /**
   * testPropsAll tests a list of DOM properties we want to check against.
   * We specify literally ALL possible (known and/or likely) properties on
   * the element including the non-vendor prefixed one, for forward-
   * compatibility.
   *
   * @access private
   * @function testPropsAll
   * @param {string} prop - A string of the property to test for
   * @param {string|object} [prefixed] - An object to check the prefixed properties on. Use a string to skip
   * @param {HTMLElement|SVGElement} [elem] - An element used to test the property and value against
   * @param {string} [value] - A string of a css value
   * @param {boolean} [skipValueTest] - An boolean representing if you want to test if value sticks when set
   */
  function testPropsAll(prop, prefixed, elem, value, skipValueTest) {

    var ucProp = prop.charAt(0).toUpperCase() + prop.slice(1),
    props = (prop + ' ' + cssomPrefixes.join(ucProp + ' ') + ucProp).split(' ');

    // did they call .prefixed('boxSizing') or are we just testing a prop?
    if (is(prefixed, 'string') || is(prefixed, 'undefined')) {
      return testProps(props, prefixed, value, skipValueTest);

      // otherwise, they called .prefixed('requestAnimationFrame', window[, elem])
    } else {
      props = (prop + ' ' + (domPrefixes).join(ucProp + ' ') + ucProp).split(' ');
      return testDOMProps(props, prefixed, elem);
    }
  }

  // Modernizr.testAllProps() investigates whether a given style property,
  // or any of its vendor-prefixed variants, is recognized
  //
  // Note that the property names must be provided in the camelCase variant.
  // Modernizr.testAllProps('boxSizing')
  ModernizrProto.testAllProps = testPropsAll;

  

  /**
   * prefixed returns the prefixed or nonprefixed property name variant of your input
   *
   * @memberof Modernizr
   * @name Modernizr.prefixed
   * @optionName Modernizr.prefixed()
   * @optionProp prefixed
   * @access public
   * @function prefixed
   * @param {string} prop - String name of the property to test for
   * @param {object} [obj] - An object to test for the prefixed properties on
   * @param {HTMLElement} [elem] - An element used to test specific properties against
   * @returns {string|false} The string representing the (possibly prefixed) valid
   * version of the property, or `false` when it is unsupported.
   * @example
   *
   * Modernizr.prefixed takes a string css value in the DOM style camelCase (as
   * opposed to the css style kebab-case) form and returns the (possibly prefixed)
   * version of that property that the browser actually supports.
   *
   * For example, in older Firefox...
   * ```js
   * prefixed('boxSizing')
   * ```
   * returns 'MozBoxSizing'
   *
   * In newer Firefox, as well as any other browser that support the unprefixed
   * version would simply return `boxSizing`. Any browser that does not support
   * the property at all, it will return `false`.
   *
   * By default, prefixed is checked against a DOM element. If you want to check
   * for a property on another object, just pass it as a second argument
   *
   * ```js
   * var rAF = prefixed('requestAnimationFrame', window);
   *
   * raf(function() {
   *  renderFunction();
   * })
   * ```
   *
   * Note that this will return _the actual function_ - not the name of the function.
   * If you need the actual name of the property, pass in `false` as a third argument
   *
   * ```js
   * var rAFProp = prefixed('requestAnimationFrame', window, false);
   *
   * rafProp === 'WebkitRequestAnimationFrame' // in older webkit
   * ```
   *
   * One common use case for prefixed is if you're trying to determine which transition
   * end event to bind to, you might do something like...
   * ```js
   * var transEndEventNames = {
   *     'WebkitTransition' : 'webkitTransitionEnd', * Saf 6, Android Browser
   *     'MozTransition'    : 'transitionend',       * only for FF < 15
   *     'transition'       : 'transitionend'        * IE10, Opera, Chrome, FF 15+, Saf 7+
   * };
   *
   * var transEndEventName = transEndEventNames[ Modernizr.prefixed('transition') ];
   * ```
   *
   * If you want a similar lookup, but in kebab-case, you can use [prefixedCSS](#modernizr-prefixedcss).
   */

  var prefixed = ModernizrProto.prefixed = function(prop, obj, elem) {
    if (prop.indexOf('@') === 0) {
      return atRule(prop);
    }

    if (prop.indexOf('-') != -1) {
      // Convert kebab-case to camelCase
      prop = cssToDOM(prop);
    }
    if (!obj) {
      return testPropsAll(prop, 'pfx');
    } else {
      // Testing DOM property e.g. Modernizr.prefixed('requestAnimationFrame', window) // 'mozRequestAnimationFrame'
      return testPropsAll(prop, obj, elem);
    }
  };

  

  /**
   * testAllProps determines whether a given CSS property is supported in the browser
   *
   * @memberof Modernizr
   * @name Modernizr.testAllProps
   * @optionName Modernizr.testAllProps()
   * @optionProp testAllProps
   * @access public
   * @function testAllProps
   * @param {string} prop - String naming the property to test (either camelCase or kebab-case)
   * @param {string} [value] - String of the value to test
   * @param {boolean} [skipValueTest=false] - Whether to skip testing that the value is supported when using non-native detection
   * @example
   *
   * testAllProps determines whether a given CSS property, in some prefixed form,
   * is supported by the browser.
   *
   * ```js
   * testAllProps('boxSizing')  // true
   * ```
   *
   * It can optionally be given a CSS value in string form to test if a property
   * value is valid
   *
   * ```js
   * testAllProps('display', 'block') // true
   * testAllProps('display', 'penguin') // false
   * ```
   *
   * A boolean can be passed as a third parameter to skip the value check when
   * native detection (@supports) isn't available.
   *
   * ```js
   * testAllProps('shapeOutside', 'content-box', true);
   * ```
   */

  function testAllProps(prop, value, skipValueTest) {
    return testPropsAll(prop, undefined, undefined, value, skipValueTest);
  }
  ModernizrProto.testAllProps = testAllProps;
  
/*!
{
  "name": "CSS Animations",
  "property": "cssanimations",
  "caniuse": "css-animation",
  "polyfills": ["transformie", "csssandpaper"],
  "tags": ["css"],
  "warnings": ["Android < 4 will pass this test, but can only animate a single property at a time"],
  "notes": [{
    "name" : "Article: 'Dispelling the Android CSS animation myths'",
    "href": "https://goo.gl/OGw5Gm"
  }]
}
!*/
/* DOC
Detects whether or not elements can be animated using CSS
*/

  Modernizr.addTest('cssanimations', testAllProps('animationName', 'a', true));

/*!
{
  "name": "CSS Transitions",
  "property": "csstransitions",
  "caniuse": "css-transitions",
  "tags": ["css"]
}
!*/

  Modernizr.addTest('csstransitions', testAllProps('transition', 'all', true));

/*!
{
  "name": "Touch Events",
  "property": "touchevents",
  "caniuse" : "touch",
  "tags": ["media", "attribute"],
  "notes": [{
    "name": "Touch Events spec",
    "href": "https://www.w3.org/TR/2013/WD-touch-events-20130124/"
  }],
  "warnings": [
    "Indicates if the browser supports the Touch Events spec, and does not necessarily reflect a touchscreen device"
  ],
  "knownBugs": [
    "False-positive on some configurations of Nokia N900",
    "False-positive on some BlackBerry 6.0 builds – https://github.com/Modernizr/Modernizr/issues/372#issuecomment-3112695"
  ]
}
!*/
/* DOC
Indicates if the browser supports the W3C Touch Events API.

This *does not* necessarily reflect a touchscreen device:

* Older touchscreen devices only emulate mouse events
* Modern IE touch devices implement the Pointer Events API instead: use `Modernizr.pointerevents` to detect support for that
* Some browsers & OS setups may enable touch APIs when no touchscreen is connected
* Future browsers may implement other event models for touch interactions

See this article: [You Can't Detect A Touchscreen](http://www.stucox.com/blog/you-cant-detect-a-touchscreen/).

It's recommended to bind both mouse and touch/pointer events simultaneously – see [this HTML5 Rocks tutorial](http://www.html5rocks.com/en/mobile/touchandmouse/).

This test will also return `true` for Firefox 4 Multitouch support.
*/

  // Chrome (desktop) used to lie about its support on this, but that has since been rectified: http://crbug.com/36415
  Modernizr.addTest('touchevents', function() {
    var bool;
    if (('ontouchstart' in window) || window.DocumentTouch && document instanceof DocumentTouch) {
      bool = true;
    } else {
      // include the 'heartz' as a way to have a non matching MQ to help terminate the join
      // https://git.io/vznFH
      var query = ['@media (', prefixes.join('touch-enabled),('), 'heartz', ')', '{#modernizr{top:9px;position:absolute}}'].join('');
      testStyles(query, function(node) {
        bool = node.offsetTop === 9;
      });
    }
    return bool;
  });


  // Run each test
  testRunner();

  // Remove the "no-js" class if it exists
  setClasses(classes);

  delete ModernizrProto.addTest;
  delete ModernizrProto.addAsyncTest;

  // Run the things that are supposed to run after the tests
  for (var i = 0; i < Modernizr._q.length; i++) {
    Modernizr._q[i]();
  }

  // Leak Modernizr namespace
  window.Modernizr = Modernizr;


;

})(window, document);
;
(function($, window, undefined) {

	'use strict';

	// global
	var Modernizr = window.Modernizr,
		$body = $('body');

	$.DLMenu = function(options, element) {
		this.$el = $(element);
		this._init(options);
	};

	$.DLMenu.defaults = {
		animationClasses: {
			classin: 'mk-vm-animate-in-' + mk_vertical_header_anim,
			classout: 'mk-vm-animate-out-' + mk_vertical_header_anim
		},
		onLevelClick: function(el, name) {
			return false;
		},
		onLinkClick: function(el, ev) {
			return false;
		}
	};

	$.DLMenu.prototype = {
		_init: function(options) {

			this.options = $.extend(true, {}, $.DLMenu.defaults, options);
			this._config();

			var animEndEventNames = {
					'WebkitAnimation': 'webkitAnimationEnd',
					'OAnimation': 'oAnimationEnd',
					'msAnimation': 'MSAnimationEnd',
					'animation': 'animationend'
				},
				transEndEventNames = {
					'WebkitTransition': 'webkitTransitionEnd',
					'MozTransition': 'transitionend',
					'OTransition': 'oTransitionEnd',
					'msTransition': 'MSTransitionEnd',
					'transition': 'transitionend'
				};

			this.animEndEventName = animEndEventNames[Modernizr.prefixed('animation')] + '.dlmenu';
			this.transEndEventName = transEndEventNames[Modernizr.prefixed('transition')] + '.dlmenu';

			this.animEndEventNameUnsufixed = animEndEventNames[Modernizr.prefixed('animation')];
			this.transEndEventNameUnsufixed = transEndEventNames[Modernizr.prefixed('transition')];

			this.supportAnimations = Modernizr.cssanimations;
			this.supportTransitions = Modernizr.csstransitions;

			this._initEvents();

		},
		_config: function() {
			this.open = false;
			this.$trigger = this.$el.children('.mk-vm-trigger');
			this.$menu = this.$el.children('ul.mk-vm-menu');
			this.$menuitems = this.$menu.find('li:not(.mk-vm-back)');
			this.$back = this.$menu.find('li.mk-vm-back');
		},
		_initEvents: function() {

			var self = this;
			
			$('.mk-vm-menuwrapper a').on('transitionend', function(event) {
				event.stopPropagation();
			});

			this.$menuitems.on('click.dlmenu', 'a', function(event) {

				// Breaks smooth scroll in vertical menu
				// event.stopPropagation();

				var $item = $(event.delegateTarget),
					$submenu = $(event.currentTarget).siblings('ul.sub-menu');

				if ($submenu.length > 0) {
					var $flyin = $submenu.clone().css('opacity', 0).insertAfter(self.$menu);
					var onAnimationEndFn = function() {
						var $parent = $item.parents('.mk-vm-subviewopen:first');
						self.$menu.off(self.animEndEventName).removeClass(self.options.animationClasses.classout).addClass('mk-vm-subview');
						$item.addClass('mk-vm-subviewopen')
						$parent.removeClass('mk-vm-subviewopen').addClass('mk-vm-subview');
						$flyin.remove();

						// Redraw for firefox issues
						var $txt = $item.find('.meni-item-text');
						$txt.css('opacity', 0.99);
						setTimeout(function() { $txt.css('opacity', 1) }, 0);
					};

					setTimeout(function() {
						$flyin.addClass(self.options.animationClasses.classin);
						self.$menu.addClass(self.options.animationClasses.classout);
						if (self.supportAnimations) {
							self.$menu.on(self.animEndEventName, onAnimationEndFn);
						} else {
							onAnimationEndFn.call();
						}

						self.options.onLevelClick($item, $item.children('a:first').text());
					});


					// This caused firefox issue. Test properly if need to bring it back
					// if (self.open) {
					// 	self._closeMenu();
					// } else {
					// 	self._openMenu();
					// }

					return false;

				} else {
					self.options.onLinkClick($item, event);
				}

			});


			// this.$trigger.on('click.dlmenu', function() {

			// 	if (self.open) {
			// 		self._closeMenu();
			// 	} else {
			// 		// if( ! $(this).hasClass('menu-item-has-children') ) return false;
			// 		self._openMenu();
			// 	}
			// 	return false;

			// });

			this.$back.on('click.dlmenu', function(event) {

				var $this = $(this),
					$submenu = $this.parents('ul.sub-menu:first'),
					$item = $submenu.parent(),

					$flyin = $submenu.clone().insertAfter(self.$menu);

				var onAnimationEndFn = function() {
					self.$menu.off(self.animEndEventName).removeClass(self.options.animationClasses.classin);
					$flyin.remove();
				};

				setTimeout(function() {
					$flyin.addClass(self.options.animationClasses.classout);
					self.$menu.addClass(self.options.animationClasses.classin);
					if (self.supportAnimations) {
						self.$menu.on(self.animEndEventName, onAnimationEndFn);
					} else {
						onAnimationEndFn.call();
					}

					$item.removeClass('mk-vm-subviewopen');

					var $subview = $this.parents('.mk-vm-subview:first');
					if ($subview.is('li')) {
						$subview.addClass('mk-vm-subviewopen');
					}
					$subview.removeClass('mk-vm-subview');
				});

				return false;

			});

		},
		closeMenu: function() {
			if (this.open) {
				this._closeMenu();
			}
		},
		_closeMenu: function() {
			var self = this,
				onTransitionEndFn = function() {
					self.$menu.off(self.transEndEventName);
					self._resetMenu();
				};

			this.$menu.removeClass('mk-vm-menuopen');
			this.$menu.addClass('mk-vm-menu-toggle');
			this.$trigger.removeClass('mk-vm-active');

			if (this.supportTransitions) {
				this.$menu.on(this.transEndEventName, onTransitionEndFn);
			} else {
				onTransitionEndFn.call();
			}

			this.open = false;
		},
		openMenu: function() {
			if (!this.open) {
				this._openMenu();
			}
		},
		_openMenu: function() {
			var self = this;
			$body.off('click').on('click.dlmenu', function() {
				self._closeMenu();
			});
			this.$menu.addClass('mk-vm-menuopen mk-vm-menu-toggle').on(this.transEndEventName, function() {
				$(this).removeClass('mk-vm-menu-toggle');
			});
			this.$trigger.addClass('mk-vm-active');
			this.open = true;
		},
		_resetMenu: function() {
			this.$menu.removeClass('mk-vm-subview');
			this.$menuitems.removeClass('mk-vm-subview mk-vm-subviewopen');
		}
	};

	var logError = function(message) {
		if (window.console) {
			window.console.error(message);
		}
	};

	$.fn.dlmenu = function(options) {
		if (typeof options === 'string') {
			var args = Array.prototype.slice.call(arguments, 1);
			this.each(function() {
				var instance = $.data(this, 'dlmenu');
				if (!instance) {
					logError("cannot call methods on dlmenu prior to initialization; " +
						"attempted to call method '" + options + "'");
					return;
				}
				if (!$.isFunction(instance[options]) || options.charAt(0) === "_") {
					logError("no such method '" + options + "' for dlmenu instance");
					return;
				}
				instance[options].apply(instance, args);
			});
		} else {
			this.each(function() {
				var instance = $.data(this, 'dlmenu');
				if (instance) {
					instance._init();
				} else {
					instance = $.data(this, 'dlmenu', new $.DLMenu(options, this));
				}
			});
		}
		return this;
	};

})(jQuery, window);
( function($) {
    'use strict';

	/* 
	 * Define popup / hover states manually to prevent click for IE on touchdevices
	 */

	$('.mk-main-navigation .menu-item-has-children').children('a').attr('aria-haspopup', 'true'); 
	$('.animated-column-item').attr('aria-haspopup', 'true');

})( jQuery );
(function($) {
    'use strict';

    var Accordion = function(el) { 
        // Private
        var that = this,
            $el = $(el),
            initial = $el.data('initialindex'),
            timeout;

        // Public
        this.$el = $el;
        this.$single = $('.' + this.dom.single, $el);
        this.isExpendable = ($el.data('style') === 'toggle-action');

        // Init 
        this.bindClicks();
        // Reveal initial tab on load event (wait for possible images inside)
        $(window).on('load', function() {
            if( initial !== -1 ) that.show(that.$single.eq(initial))
        });
        $(window).on('resize', function() {
            clearTimeout(timeout);
            timeout = setTimeout(that.bindClicks.bind(that), 500);
        }); 
    }

    Accordion.prototype.dom = {
        // only class names please!
        single        : 'mk-accordion-single',
        tab           : 'mk-accordion-tab',
        pane          : 'mk-accordion-pane',
        current       : 'current',
        mobileToggle  : 'mobile-false',
        mobileBreakPoint : 767
    }

    Accordion.prototype.bindClicks = function() {
        // Prevent multiple events binding
        this.$single.off('click', '.' + this.dom.tab);

        if( !(window.matchMedia('(max-width: ' + this.dom.mobileBreakPoint +'px)').matches 
          && this.$el.hasClass(this.dom.mobileToggle)) ) {

            this.$single.on('click', '.' + this.dom.tab, this.handleEvent.bind(this));
            // When website is loaded in mobile view and resized to desktop 'current' will 
            // inherit display: none from css. Repair it by calling show() on this element
            var $current = $('.' + this.dom.current, this.$el);
            if($('.' + this.dom.pane, $current).css('display') === 'none') this.show($current);
        }
    }

    Accordion.prototype.handleEvent = function(e) {
        e.preventDefault();
        e.stopPropagation();

        var $single = $(e.delegateTarget);

        if(!$single.hasClass(this.dom.current)) {
            this.show($single);
        }
        else {
            if(this.isExpendable) this.hide($single);
        }
    }

    Accordion.prototype.hide = function($single) {
        $single.removeClass(this.dom.current);
        $('.' + this.dom.pane, $single).slideUp();
    }

    Accordion.prototype.show = function($single) {
        // hide currently opened tab
        if(!this.isExpendable) {
            var that = this;
            this.hide($('.' + this.dom.current, that.$el));
        }

        $single.addClass(this.dom.current);
        $('.' + this.dom.pane, $single).slideDown();
    }



    // ///////////////////////////////////////
    //
    // Apply to:
    //
    // ///////////////////////////////////////

    $('.mk-accordion').each(function() {
        new Accordion(this);
    });

})(jQuery);

(function($) {

	'use strict';

	if( typeof Raphael === 'undefined' ) return;

	var SkillDiagram = function( el ) {
		this.el = el;
	}

	SkillDiagram.prototype = {
		init : function() {
			this.cacheElements();
			this.createDiagram();
			this.$skills.each( this.createSkill.bind( this ) );
		},

		cacheElements : function() {
			this.$el = $( this.el );
			this.$skills = this.$el.find( '.mk-meter-arch');
			this.config  = this.$el.data();
			this.config.radius = this.config.dimension / 2;
		},

		random : function( l, u ) {
        	return Math.floor( ( Math.random() * ( u - l + 1 ) ) + l );
		},

		createDiagram : function() {
			var self = this;

			this.diagram = Raphael( this.el, this.config.dimension, this.config.dimension );

			// Make svg scalable in different screen sizes
			this.diagram.setViewBox(0,0,this.config.dimension,this.config.dimension,true);
			this.diagram.setSize('90%', '90%');

			this.diagram.circle( this.config.radius, this.config.radius, 80 ).attr({ 
				stroke: 'none', 
				fill: this.config.circleColor 
			});
        
        	// Export title
	        this.title = this.diagram.text( this.config.radius, this.config.radius, this.config.defaultText ).attr({
	            font: "22px helvetica",
	            fill: this.config.defaultTextColor
	        }).toFront();
	        
	        this.diagram.customAttributes.arc = function(value, color, rad){
	            var v = 3.6 * value,
	                alpha = v == 360 ? 359.99 : v,
	                r  = self.random( 91, 240 ),
	                a  = (r - alpha) * Math.PI/180,
	                b  = r * Math.PI/180,
	                sx = self.config.radius + rad * Math.cos(b),
	                sy = self.config.radius - rad * Math.sin(b),
	                x  = self.config.radius + rad * Math.cos(a),
	                y  = self.config.radius - rad * Math.sin(a),
	                path = [['M', sx, sy], ['A', rad, rad, 0, +(alpha > 180), 1, x, y]];

	            return { 
	            	path: path, 
	            	stroke: color 
	            }
	        }
		},

		createSkill : function( id, el ) {
			var self   = this,
				$this  = $( el ),
				config = $this.data(),
				radMin = 72,
				radVal = 27,
				newRad = radMin + ( radVal * (id + 1) );

			var $path = this.diagram.path().attr({
				'stroke-width': 28,
				arc: [config.percent, config.color, newRad]
			});

			$path.mouseover( function() {
				self.showSkill( this, config.name, config.percent );
			}).mouseout( function() {
				self.hideSkill( this ) 
			});
		},

		showSkill : function( self, name, percent ) {
			var $this = self,
				time = 250;

            //solves IE problem
            if(Raphael.type != 'VML') $this.toFront();

            $this.animate({ 
            	'stroke-width': 50, 
            	'opacity': 0.9, 
            }, 800, 'elastic' );

            this.title.stop()
            	.animate({ opacity: 0 }, time, '>', function(){
	                this.attr({ text: name + '\n' + percent + '%' }).animate({ opacity: 1 }, time, '<');
	            }).toFront();
		},

		hideSkill : function( self ) {
			var $this = self,
				self = this,
				time = 250;

            $this.stop().animate({ 
            	'stroke-width': 28, 
            	opacity: 1 
            }, time * 4, 'elastic' );

            self.title.stop()
            	.animate({ opacity: 0 }, time, '>', function(){
	                self.title.attr({ text: self.config.defaultText })
	                .animate({ opacity: 1 }, time, '<');
            	}); 
		}
	}


	$( '.mk-skill-diagram' ).each( function() {
		var diagram = new SkillDiagram( this );
			diagram.init();
	});


})(jQuery);
/*
 * Tab delegation 
 * Action for modules when we don't have access to chidren DOM on processing templates
 * yet we want ass option of opening link in new tab. 
 * Helpful for use with external widgets like flickr
 */

(function($) {

	'use strict';

	$( '[data-js="tab-delegation"]' ).each( tabDelegation );

	function tabDelegation() {
		var $this = $( this ),
			data  = $this.data();

		// Create delegation on parent element to affect async loaded children
		if( data.tab ) $this.on( 'click', 'a', openInTab );
	}

	function openInTab( e ) {
		e.preventDefault(); 

		var $this = $( this ),
			url = $this.attr( 'href' );

		window.open( url, '_blank' );
	}

})(jQuery);
(function($) {
    'use strict';

    var Toggle = function(el) {
        var that = this,
            $el = $(el);

        this.$el = $el;

        $(window).on('load', function() {
            $el.toggle(that.open.bind(that), that.close.bind(that));
        });
    };

    Toggle.prototype.dom = {
        pane   : 'mk-toggle-pane',
        active : 'active-toggle'
    };

    Toggle.prototype.open = function() {
        var $this = this.$el;
        $this.addClass(this.dom.active);
        $this.siblings('.' + this.dom.pane).slideDown(200);
    };

    Toggle.prototype.close = function() {
        var $this = this.$el;
        $this.removeClass(this.dom.active);
        $this.siblings('.' + this.dom.pane).slideUp(200);
    };



    // ///////////////////////////////////////
    //
    // Apply to:
    //
    // ///////////////////////////////////////

    var $toggle = $('.mk-toggle-title');

    if(!$toggle.length) return;

    $toggle.each(function() {
        new Toggle(this);
    });

})(jQuery);
//////////////////////////////////////////////////////////////////////////
//
//   Init all scripts
//
//////////////////////////////////////////////////////////////////////////

// This is bad but we don't have other access to this scope.
// Ajax Portfolio  is defined as plugin and on success needs these to be reinited
// We'll refactor all of this.
window.ajaxInit = function() {
    mk_lightbox_init();
    mk_click_events(); 
    mk_social_share_global();
   // mk_social_share();
    mk_gallery();
    loop_audio_init();
};

window.ajaxDelayedInit = function() {
    mk_flexslider_init();
    // mk_portfolio_ajax(); 
};

$(document).ready(function() {
    mk_lightbox_init();
    mk_login_form();
    mk_backgrounds_parallax();
    mk_flexslider_init();
    mk_event_countdown();
    mk_skill_meter();
    mk_milestone();
    mk_ajax_search();
    mk_hover_events();
    mk_portfolio_ajax();
    mk_love_post();
    product_loop_add_cart();
  //  mk_social_share();
    mk_portfolio_widget();
    mk_contact_form();
    mk_blog_carousel();
    mk_header_searchform();
    mk_click_events();
    mk_text_typer();
    mk_tab_slider_func();

    $(window).on('load', function() {
        mk_unfold_footer();
        mk_tabs();
        mk_accordion_toggles_tooltip();
        mk_gallery();
        mk_theatre_responsive_calculator();
        mk_tabs_responsive();
        mk_start_tour_resize();
        mk_header_social_resize();
        mk_page_section_social_video_bg();
        loop_audio_init();
        mk_one_page_scroller();
                        
        setTimeout(function() {
            /* 
                Somehow the values are not correctly updated for the screens
                and we need to put setTimeout to fix the issue
            */
            mk_mobile_tablet_responsive_calculator();
        }, 300);

        console.log("ready for rock");
    });

 
    var onDebouncedResize = function() {
        mk_theatre_responsive_calculator();
        mk_mobile_tablet_responsive_calculator();
        mk_tabs_responsive();
        mk_accordion_toggles_tooltip();
        mk_start_tour_resize();
        mk_header_social_resize();

        setTimeout(function() {
            mk_unfold_footer();
        }, 300);
    };

    var debounceResize = null;
    $(window).on("resize", function() {
        if( debounceResize !== null ) { clearTimeout( debounceResize ); }
        debounceResize = setTimeout( onDebouncedResize, 300 );
    });

    var onDebouncedScroll = function() {
        mk_skill_meter();
        //TODO: Ask to Bart how we can call javascript component
        //mk_charts();
        mk_milestone();
    };

    var debounceScroll = null;
    $(window).on("scroll", function() {
        if( debounceScroll !== null ) { clearTimeout( debounceScroll ); }
        debounceScroll = setTimeout( onDebouncedScroll, 100 );
    });

    if (MK.utils.isMobile()) {
        $('body').addClass('no-transform');
    }

});

/* Typer */
/* -------------------------------------------------------------------- */
function mk_text_typer() {

    "use strict";

    $('[data-typer-targets]').each(function() {
        var that = this;
        MK.core.loadDependencies([ MK.core.path.plugins + 'jquery.typed.js' ], function() {
            var $this = $(that),
                $first_string = [$this.text()],
                $rest_strings = $this.attr('data-typer-targets').split(','),
                $strings = $first_string.concat($rest_strings);

            $this.text('');

            $this.typed({
                strings: $strings,
                typeSpeed: 30, // typing speed
                backDelay: 1200, // pause before backspacing
                loop: true, // loop on or off (true or false)
                loopCount: false, // number of loops, false = infinite
            });
        });
    });
}



/* Tab Slider */
/* -------------------------------------------------------------------- */

function mk_tab_slider_func() {

    "use strict";

    $('.mk-tab-slider').each(function() {
        var that = this;

        MK.core.loadDependencies([ MK.core.path.plugins + 'jquery.swiper.js' ], function() {
            var $this = $(that),
                id = $this.data('id'),
                $autoplayTime = $this.data('autoplay'),
                $content = $('.mk-slider-content');

            var mk_tab_slider = $this.swiper({
                wrapperClass: 'mk-tab-slider-wrapper',
                slideClass: 'mk-tab-slider-item',
                calculateHeight: true,
                speed: 500,
                autoplay: isTest ? false : $autoplayTime,
                onSlideChangeStart: function() {
                    $('.mk-tab-slider-nav[data-id="' + id + '"]').find(".active").removeClass('active')
                    $('.mk-tab-slider-nav[data-id="' + id + '"]').find("a").eq(mk_tab_slider.activeIndex).addClass('active')
                }
            });

            // Simple repaint for firefox issue (can't handle 100% height after plugin init)
            function repaintFirefox() {
                $content.css('display','block');
                setTimeout(function() {
                    mk_tab_slider.reInit();
                    $content.css('display','table');
                },100);  
            }

            $('.mk-tab-slider-nav[data-id="' + id + '"]').find("a").first().addClass('active');

            $('.mk-tab-slider-nav[data-id="' + id + '"]').find("a").on('touchstart mousedown', function(e) {
                e.preventDefault()
                $('.mk-tab-slider-nav[data-id="' + id + '"]').find(".active").removeClass('active')
                $(this).addClass('active')
                mk_tab_slider.swipeTo($(this).index())
            });

            $('.mk-tab-slider-nav[data-id="' + id + '"]').find("a").click(function(e) {
                e.preventDefault();
            });

            repaintFirefox();
            $(window).on('resize', repaintFirefox);
        });

    });

}



/* Edge One Pager */
/* -------------------------------------------------------------------- */
function mk_one_page_scroller() {

    "use strict";

    $('.mk-edge-one-pager').each(function() {
        var self = this;

        MK.core.loadDependencies([ MK.core.path.plugins + 'jquery.fullpage.js' ], function() {

            var $this = $(self),
                anchorArr = [];

            $this.find('.section').each(function() {
                anchorArr.push($(this).attr('data-title'));
            });

            var scrollable = true;
            $this.find('.section').each(function() {
                var $section = $(this),
                    $content = $section.find('.edge-slide-content'),
                    sectionHeight = $section.height(),
                    contentHeight = $content.innerHeight();

                if((contentHeight + 30) > $(window).height()) {
                    scrollable = false;
                }
            });

            if(!scrollable){
                $this.find('.section').each(function() {
                    var $section = $(this);
                    $section.addClass('active').css({
                        'padding-bottom': '50px'
                    });
                });
            }

            if(scrollable) {
                $this.fullpage({
                    verticalCentered: false,
                    resize: true,
                    slidesColor: ['#ccc', '#fff'],
                    anchors: anchorArr,
                    scrollingSpeed: 600,
                    easing: 'easeInQuart',
                    menu: false,
                    navigation: true,
                    navigationPosition: 'right',
                    navigationTooltips: false,
                    slidesNavigation: true,
                    slidesNavPosition: 'bottom',
                    loopBottom: false,
                    loopTop: false,
                    loopHorizontal: true,
                    autoScrolling: true,
                    scrollOverflow: false,
                    css3: true,
                    paddingTop: 0,
                    paddingBottom: 0,
                    normalScrollElements: '.mk-header, .mk-responsive-wrap',
                    normalScrollElementTouchThreshold: 5,
                    keyboardScrolling: true,
                    touchSensitivity: 15,
                    continuousVertical: false,
                    animateAnchor: true,

                    onLeave: function(index, nextIndex, direction) {
                        var currentSkin = $this.find('.one-pager-slide').eq(nextIndex - 1).attr('data-header-skin');
                        MK.utils.eventManager.publish( 'firstElSkinChange', currentSkin );
                        $('#fullPage-nav').removeClass('light-skin dark-skin').addClass(currentSkin + '-skin');

                    }, 
                    afterRender: function() {

                        var $nav = $('#fullPage-nav');

                        setTimeout(function() {
                            var currentSkin = $this.find('.one-pager-slide').eq(0).attr('data-header-skin');
                            MK.utils.eventManager.publish( 'firstElSkinChange', currentSkin );
                            if($nav.length) $nav.removeClass('light-skin dark-skin').addClass(currentSkin + '-skin');
                        }, 300);

                        var $slide = $this.find('.section'),
                            headerHeight = MK.val.offsetHeaderHeight(0),
                            windowHeight = $(window).height();

                        $slide.height(windowHeight - headerHeight);

                        if($nav.length) {
                            $nav.css({
                                'top': 'calc(50% + ' + (headerHeight/2) + 'px)',
                                'marginTop': 0
                            });

                            var style = $this.attr('data-pagination');
                            $nav.addClass('pagination-' + style);
                        }

                        setTimeout(mk_one_pager_resposnive, 1000);
                    },
                    afterResize: function() {
                        var $slide = $this.find('.section'),
                            headerHeight = MK.val.offsetHeaderHeight(0),
                            windowHeight = $(window).height();

                        $slide.height(windowHeight - headerHeight);

                        $('#fullPage-nav').css({
                            'top': 'calc(50% + ' + (headerHeight/2) + 'px)',
                            'marginTop': 0
                        });

                        setTimeout(mk_one_pager_resposnive, 1000);
                        console.log('Reposition pager content.');
                    },
                });
            }

            // Linking to slides available for desktop and mobile scenarios
            function swipeTo(href, e) {
                href = '_' + href; // ensure a char before #
                if (!~href.indexOf('#')) return;
                var section = href.split('#')[1];
                if (~anchorArr.indexOf(section)) {
                    if (typeof e !== 'undefined') e.preventDefault();
                    if (scrollable) $.fn.fullpage.moveTo(section);
                    else MK.utils.scrollToAnchor('[data-title="'+section+'"]');
                }
            }

            // onload
            var loc = window.location;
            if(loc.hash) swipeTo(loc.hash);

            $(document).on('click', 'a', function(e) {
                var $link = $(e.currentTarget);
                swipeTo($link.attr('href'), e);
            });
        });
    });

    

}


function mk_one_pager_resposnive() {
    "use strict";

    $('.mk-edge-one-pager').each(function() {
        var $pager = $(this),
            headerHeight = MK.val.offsetHeaderHeight(0),
            windowHeight = $(window).height() - headerHeight;

        $pager.find('.one-pager-slide').each(function() {
            var $slide = $(this),
                $content = $slide.find('.edge-slide-content');

            if ($slide.hasClass('left_center') || $slide.hasClass('center_center') || $slide.hasClass('right_center')) {
                var contentHeight  = $content.height(),
                    distanceFromTop = (windowHeight - contentHeight) / 2;

                distanceFromTop  = (distanceFromTop < 50) ? 50 + headerHeight : distanceFromTop;

                $content.css('marginTop', distanceFromTop);
            }

            if ($slide.hasClass('left_bottom') || $slide.hasClass('center_bottom') || $slide.hasClass('right_bottom')) {
                var distanceFromTop = windowHeight - $content.height() - 90;
                $content.css('marginTop', (distanceFromTop));
            }
        });
    });
}

/* Image Gallery */
/* -------------------------------------------------------------------- */

function mk_gallery() {

    "use strict";

    $('.mk-gallery .mk-gallery-item.hover-overlay_layer .item-holder').each(function() {
        var itemHolder = $(this),
            galleryDesc = itemHolder.find('.gallery-desc');

        function updatePosition() {
            var parentHeight = itemHolder.outerHeight(),
                contentHeight = galleryDesc.innerHeight();

            var paddingVal = (parentHeight - contentHeight) / 2;
            galleryDesc.css({
                'top': paddingVal,
                // 'padding-bottom': paddingVal
            });

            // console.log(parentHeight);
            // console.log(contentHeight);


        }
        updatePosition();

        $(window).on('resize', function() {
            setTimeout(function() {
                updatePosition();
            }, 1000);
        });
    });
}

/* Theatre Slider Responsive Calculator */
/* -------------------------------------------------------------------- */

function mk_theatre_responsive_calculator() {
    var $laptopContainer = $(".laptop-theatre-slider");
    var $computerContainer = $(".desktop-theatre-slider");
    $laptopContainer.each(function() {
        var $this = $(this),
            $window = $(window),
            $windowWidth = $window.outerWidth(),
            $windowHeight = $window.outerHeight(),
            $width = $this.outerWidth(),
            $height = $this.outerHeight(),
            $paddingTop = 38,
            $paddingRight = 143,
            $paddingBottom = 78,
            $paddingLeft = 143;

        var $player = $this.find('.player-container');

        if ($windowWidth > $width) {
            $player.css({
                'padding-left': parseInt(($width * $paddingLeft) / 1200),
                'padding-right': parseInt(($width * $paddingRight) / 1200),
                'padding-top': parseInt(($height * $paddingTop) / 690),
                'padding-bottom': parseInt(($height * $paddingBottom) / 690),
            });
        }

    });

    $computerContainer.each(function() {
        var $this = $(this),
            $window = $(window),
            $windowWidth = $window.outerWidth(),
            $windowHeight = $window.outerHeight(),
            $width = $this.outerWidth(),
            $height = $this.outerHeight(),
            $paddingTop = 60,
            $paddingRight = 52,
            $paddingBottom = 290,
            $paddingLeft = 49;

        var $player = $this.find('.player-container');

        if ($windowWidth > $width) {
            $player.css({
                'padding-left': parseInt(($width * $paddingLeft) / 1200),
                'padding-right': parseInt(($width * $paddingRight) / 1200),
                'padding-top': parseInt(($height * $paddingTop) / 969),
                'padding-bottom': parseInt(($height * $paddingBottom) / 969),
            });
        }

    });

}

/* Mobile and Tablet Slideshow Responsive Calculator */
/* -------------------------------------------------------------------- */
function mk_mobile_tablet_responsive_calculator() {
    var $laptopSlideshow = $(".mk-laptop-slideshow-shortcode");
    var $lcdSlideshow = $(".mk-lcd-slideshow");

    if ($.exists(".mk-laptop-slideshow-shortcode")) {
        $laptopSlideshow.each(function() {
            var $this = $(this),
                $window = $(window),
                $windowWidth = $window.outerWidth(),
                $windowHeight = $window.outerHeight(),
                $width = $this.outerWidth(),
                $height = $this.outerHeight(),
                $paddingTop = 28,
                $paddingRight = 102,
                $paddingBottom = 52,
                $paddingLeft = 102;

            var $player = $this.find(".slideshow-container");

            $player.css({
                "padding-left": parseInt(($width * $paddingLeft) / 836),
                "padding-right": parseInt(($width * $paddingRight) / 836),
                "padding-top": parseInt(($height * $paddingTop) / 481),
                "padding-bottom": parseInt(($height * $paddingBottom) / 481),
            });

        });
    }

    if ($.exists(".mk-lcd-slideshow")) {
        $lcdSlideshow.each(function() {
            var $this = $(this),
                $window = $(window),
                $windowWidth = $window.outerWidth(),
                $windowHeight = $window.outerHeight(),
                $width = $this.outerWidth(),
                $height = $this.outerHeight(),
                $paddingTop = 35,
                $paddingRight = 39,
                $paddingBottom = 213,
                $paddingLeft = 36;

            var $player = $this.find(".slideshow-container");
            $player.css({
                "padding-left": parseInt(($width * $paddingLeft) / 886),
                "padding-right": parseInt(($width * $paddingRight) / 886),
                "padding-top": parseInt(($height * $paddingTop) / 713),
                "padding-bottom": parseInt(($height * $paddingBottom) / 713),
            });
        });
    }
}


/* Start a tour resize function */
/* -------------------------------------------------------------------- */
function mk_start_tour_resize() {

    $('.mk-header-start-tour').each(function() {

        var $windowWidth = $(document).width(),
            $this = $(this),
            $linkWidth = $this.width() + 15,
            $padding = ($windowWidth - mk_responsive_nav_width) / 2;



        function updateStartTour(){
            if($windowWidth < mk_responsive_nav_width){
                $this.removeClass('hidden');
                $this.addClass('show');
            }else{
                if($padding < $linkWidth){
                    $this.removeClass('show');
                    $this.addClass('hidden');
                }else{
                    $this.removeClass('hidden');
                    $this.addClass('show');
                }
            }
        }

        setTimeout(function() {
            updateStartTour();
        }, 300);
    });
}

/* Header social resize function */
/* -------------------------------------------------------------------- */
function mk_header_social_resize() {

    $('.mk-header-social.header-section').each(function() {

        var $windowWidth = $(document).width(),
            $this = $(this),
            $linkWidth = $this.width() + 15,
            $padding = ($windowWidth - mk_responsive_nav_width) / 2;



        function updateStartTour(){
            if($windowWidth < mk_responsive_nav_width){
                $this.removeClass('hidden');
                $this.addClass('show');
            }else{
                if($padding < $linkWidth){
                    $this.removeClass('show');
                    $this.addClass('hidden');
                }else{
                    $this.removeClass('hidden');
                    $this.addClass('show');
                }
            }
        }

        setTimeout(function() {
            updateStartTour();
        }, 300);
    });
}

/* Page Section Socail Video Player Controls */
/* -------------------------------------------------------------------- */

function mk_page_section_social_video_bg() {
    $(".mk-page-section.social-hosted").each(function() {
        var $container = $(this),
            $sound = $container.data('sound'),
            $source = $container.data('source'),
            player;


        if ($source == 'youtube') {
            var youtube = $container.find('iframe')[0];
            player = new YT.Player(youtube);
            setTimeout(function() {
                player.playVideo();
                if($sound == false) {
                    player.mute();    
                }
            }, 1000);
        }
        if ($source == 'vimeo') {
            var vimeo = $container.find('iframe')[0];
            player = $f(vimeo);
            setTimeout(function() {
                player.api('play');
                if($sound === false) {
                    player.api('setVolume', 0);
                }
            }, 1000);
        }

    });
}

// Pre RequireJS hot bug fixing

function videoLoadState() {
    $('.mk-section-video video').each(function() {
        var mkVideo = this;

        this.onload = fire();

        function fire() {
            setTimeout(function() {
                $(mkVideo).animate({
                    'opacity': 1
                }, 300);
            }, 1000);
        }
    });
}
videoLoadState();


// Gmap Widget
(function($) {

    $(window).on('load', initialize);

    function initialize() {
        var $gmap = $('.gmap_widget');
        if($gmap.length && typeof google !== 'undefined') $gmap.each(run);
    }

    function run() {
        var $mapHolder = $(this);
        var myLatlng = new google.maps.LatLng($mapHolder.data('latitude'), $mapHolder.data('longitude'));
        var mapOptions = $mapHolder.data('options');
            mapOptions.mapTypeId = google.maps.MapTypeId.ROADMAP;
            mapOptions.center = myLatlng;
        var map = new google.maps.Map(this, mapOptions);

        new google.maps.Marker({
            position: myLatlng,
            map: map
        });
    }

}(jQuery));

// Instagram Widget
(function($) {

    $(window).on('load', function() {
        var $feeds = $('.mk-instagram-feeds');
        if($feeds.length) $feeds.each(run);
    });

    function run() {
        var options = $(this).data('options');
            options.template = '<a class="featured-image '+options.tmp_col+'-columns" href="{{link}}" target="_'+options.tmp_target+'"><div class="item-holder"><img src="{{image}}" /><div class="image-hover-overlay"></div></div></a>';
        var feed = new Instafeed(options);
        feed.run();
    }
}(jQuery));


// Flipbox backface visibility fix for chrome
(function($) {
     $(window).on('load', function() {
         setTimeout( function() {
            $('.chrome-flipbox-backface-fix').removeClass('chrome-flipbox-backface-fix');
         }, 300);
     });
}(jQuery));


/* Product in VC Tab Bug Fix
/* -------------------------------------------------------------------- */
(function($) {
    $(window).on('load', function() {
        $('.vc_tta-tab a').on('click', function() {
            setTimeout( function() {
                $(window).trigger('resize');
            }, 100);
        });
    });
}(jQuery));


/* Vertical menu fix when childrens exceed screen height
/* -------------------------------------------------------------------- */
(function($) {
    $(window).on('load', function() {
        $('#mk-vm-menu .menu-item-has-children, #mk-vm-menu .mk-vm-back').on('mouseenter', function() {
            var $header_inner = $(this).closest('.mk-header-inner'),
                $header_inner_height = $header_inner.outerHeight(),
                $header_bg = $header_inner.find('.mk-header-bg'),
                total_height = 0;
            $header_bg.css('height', '100%');
            setTimeout( function() {
                $header_inner.children(':visible').each(function() {
                    total_height += $(this).outerHeight(true);
                });
                total_height -= $header_bg.height();
                if ( total_height < $header_inner_height ) {
                    $header_bg.css('height', '100%');
                } else {
                    $header_bg.css('height', total_height + 'px');
                }
            }, 600);
        });
    });
}(jQuery));


/* Woocommerce varitions lightbox fix
/* -------------------------------------------------------------------- */
(function($) {
    $(window).on('load', function() {

        var $variations_form = $('.variations_form'),
            $lightbox = $('.mk-product-image .mk-lightbox'),
            $product_img = $lightbox.find('img'),
            $varitions_selects = $variations_form.find('.variations').find('.value').find('select');

        if ( $variations_form.length ) {

            $varitions_selects.on('change', function() {
                setTimeout( function() {
                    var image_url = $product_img.attr('src'),
                        image_suffix = image_url.substr( image_url.lastIndexOf('.') - image_url.length ), // Get image suffix
                        image_url = image_url.slice( 0 , image_url.lastIndexOf('-') ); // Remove image size
                    $lightbox.attr('href', image_url + image_suffix);
                }, 300);
            });
            $varitions_selects.trigger('change');

        }

    });
}(jQuery));


/* Remove video section when on mobile */
/* -------------------------------------------------------------------- */
(function($) {
    if ( MK.utils.isMobile() ) {
      $('.mk-section-video video').remove();
    }
}(jQuery));


/* Yith AJAX Product Filter & Yith Infinite Scrolling Plugin Fix
/* -------------------------------------------------------------------- */
(function($) {
    $(window).on('load', function() {

        $(document).on( 'yith-wcan-ajax-filtered yith_infs_added_elem yith-wcan-ajax-reset-filtered', function(){
            setTimeout( function() {
                MK.utils.eventManager.publish('ajaxLoaded');
                MK.core.initAll( document );
            }, 1000 );
        });

    });
}(jQuery));

function mk_accordion_toggles_tooltip() {

  "use strict";


  /* Message Boxes */
  /* -------------------------------------------------------------------- */

  $('.box-close-btn').on('click', function() {
    $(this).parent().fadeOut(300);
    return false;

  });

}

function mk_portfolio_ajax() {
  "use strict";

  var headerHeight = 0;
  if ($.exists("#wpadminbar")) {
    headerHeight += $("#wpadminbar").height();
  }
  if (!$.exists('.mk-vm-menuwrapper')) {
    headerHeight += parseInt($('.mk-header').attr('data-sticky-height'));
  }

  function init() {
    var $portfolio = $('.portfolio-grid.portfolio-ajax-enabled');
    if (!$portfolio.length) return; // quit if no portfolio wrappers
    MK.core.loadDependencies([ MK.core.path.plugins + 'jquery.ajax.portfolio.js' ], function() {
      // wait for ajax response propagation and insertion
      setTimeout(function() {
        $portfolio.each( function() {
          $(this).ajaxPortfolio({ extraOffset: headerHeight });
        });
      }, 100);
    });
  }

  init();

  // Reinit when ajax loaded stuff
  // We have global reinit on Components. so move the ajaxPortfolio to component namespace as a standalone module to get it right.
  MK.utils.eventManager.subscribe('ajaxLoaded', init);
}

/**
 * Ajax Search on header nav.
 */
function mk_ajax_search() {
    "use strict";

    // Check if ajax search box enabled.
    if (mk_ajax_search_option !== "beside_nav") {
        return;
    }

    // Set minimum length of text to get ajax result.
    var minimumLengthToSearch = 3;
    var $mkAjaxSearchInput = $('#mk-ajax-search-input');
    var security = $mkAjaxSearchInput.siblings('input[name="security"]').val();
    var wpHttpReferer = $mkAjaxSearchInput.siblings('input[name="_wp_http_referer"]').val();
    var querySpliter = (ajaxurl.indexOf('?') > -1) ? '&' : '?';
    var ul = document.getElementById('mk-nav-search-result');
    var searchTerm; // Search term
    var requestCounter = 0;
    var responseCounter = 0;

    // Add listener for getting result quickly while user entering text, past text and etc.
    $mkAjaxSearchInput.on('paste input propertychange', onSearchBoxInput);

    /**
     * Callback function for entering search term listener (e.g. keyup).
     * It will generate AJAX request to get data.
     *
     * @param e
     */
    function onSearchBoxInput(e) {
        var target = e.target || e.srcElement;
        var newValue = target.value;

        // Check if user change the value of text box
        if (searchTerm !== newValue) {
            searchTerm = newValue;
            ul.innerHTML = '';
            if (searchTerm.length >= minimumLengthToSearch) {
                // Show loading icon
                $mkAjaxSearchInput.addClass('ajax-searching');
                requestCounter++;
                $.getJSON(ajaxurl + querySpliter + 'callback=?&action=mk_ajax_search&security=' + security + '&_wp_http_referer=' + wpHttpReferer + '&term=' + searchTerm)
                    .done(showSearchResult)
                    .fail(showErrorMessage);
            }
        }
    }

    /**
     * Callback function for the response of the search request.
     *
     * @param data
     */
    function showSearchResult(data) {
        responseCounter++;

        // Only show response of latest request.
        if (isCorrectResponse()) {
            if (data.length > 0) {
                // Append result to result container
                for (var i = 0; i < data.length; i++) {
                    var item = data[i];
                    $('<li>').append('<a href="' + item.link + '">' + item.image + '<span class="search-title">' + item.label + '</span><span class="search-date">' + item.date + '</span></a>').appendTo(ul);
                }
            } else {
                // Show no result message
                ul.innerHTML = '<li class="mk-nav-search-result-zero">No Result.</li>';
            }

            // Hide loading icon
            $mkAjaxSearchInput.parent('form').removeClass('ajax-searching').addClass('ajax-search-complete');
        }
    }

    /**
     * If any errors, we need a handler to show error message.
     */
    function showErrorMessage() {
        responseCounter++;

        if (isCorrectResponse()) {
            ul.innerHTML = '<li class="mk-nav-search-error-message">Can not search! Please try again.</li>';
        }
    }

    /**
     * Check if the response is right for the request. we show latest response only.
     *
     * @returns {boolean}
     */
    function isCorrectResponse() {
        return requestCounter === responseCounter;
    }
}
/* Background Parallax Effects */
/* -------------------------------------------------------------------- */

function mk_backgrounds_parallax() {

  "use strict";

  if (mk_header_parallax == true) {
    $('.mk-header-bg').addClass('mk-parallax-enabled');
  }
  if (mk_body_parallax == true) {
    $('body').addClass('mk-parallax-enabled');
  }
  if (mk_banner_parallax == true) {
    $('.mk-header').addClass('mk-parallax-enabled');
  }
  if (mk_footer_parallax == true) {
    $('#mk-footer').addClass('mk-parallax-enabled');
  }

  $('.mk-parallax-enabled').each(function () {
    var $this = $( this );
    if (!MK.utils.isMobile()) {
      MK.core.loadDependencies([ MK.core.path.plugins + 'jquery.parallax.js' ], function() {
        $this.parallax("49%", 0.3);
      });
    }
  });

  $('.mk-fullwidth-slideshow.parallax-slideshow').each(function () {
    var $this = $( this );
    if (!MK.utils.isMobile()) {
      MK.core.loadDependencies([ MK.core.path.plugins + 'jquery.parallax.js' ], function() {
        var speed_factor = $this.attr('data-speedFactor');
        $this.parallax("49%", speed_factor);
      });
    }
  });

}
/* Blog, Portfolio Audio */
/* -------------------------------------------------------------------- */

function loop_audio_init() {
  if ($.exists('.jp-jplayer')) {
    $('.jp-jplayer.mk-blog-audio').each(function () {
      var $this = $( this );
      MK.core.loadDependencies([ MK.core.path.plugins + 'jquery.jplayer.js' ], function() {
        var css_selector_ancestor = "#" + $this.siblings('.jp-audio').attr('id');
        var ogg_file, mp3_file, mk_theme_js_path;
        ogg_file = $this.attr('data-ogg');
        mp3_file = $this.attr('data-mp3');
        $this.jPlayer({
          ready: function () {
            $this.jPlayer("setMedia", {
              mp3: mp3_file,
              ogg: ogg_file
            });
          },
          play: function () { // To avoid both jPlayers playing together.
            $this.jPlayer("pauseOthers");
          }, 
          swfPath: mk_theme_js_path,
          supplied: "mp3, ogg",
          cssSelectorAncestor: css_selector_ancestor,
          wmode: "window"
        });
      });
    });
  }
}


/* Blog Loop Carousel Shortcode */
/* -------------------------------------------------------------------- */


function mk_blog_carousel() {

  "use strict";

  if (!$.exists('.mk-blog-showcase')) {
    return;
  }
  $('.mk-blog-showcase ul li').each(function () {

    $(this).on('hover', function () {

      $(this).siblings('li').removeClass('mk-blog-first-el').end().addClass('mk-blog-first-el');

    });

  });


}




/**
 * Contact Form
 *
 * Mostly implemented in Vanilla JS instead of jQuery.
 */

function mk_contact_form() {
    "use strict";

    var mkContactForms = document.getElementsByClassName('mk-contact-form');

    if (mkContactForms.length === 0) {
        return;
    }

    var captchaImageHolder = $('.captcha-image-holder');
    var activeClassName = 'is-active';
    var invalidClassName = 'mk-invalid';

    for (var i = 0; i < mkContactForms.length; i++) {
        initializeForm(mkContactForms[i], activeClassName, invalidClassName);
    }

    initializeCaptchas();

    /**
     * Initialize mk forms. e.g add activeClassName for inputs.
     *
     * @param form
     * @param activeClassName
     * @param invalidClassName
     */
    function initializeForm(form, activeClassName, invalidClassName) {
        var inputs = getFormInputs(form);

        for (var i = 0; i < inputs.length; i++) {
            markActiveClass(inputs[i]);
        }

        form.addEventListener('submit', function (e) {
            validateForm(e, invalidClassName);
        });

        /**
         * Set activeClassName for the parent node of the inout
         */
        function setActiveClass() {
            addClass(this.parentNode, activeClassName);
        }

        /**
         * Unset activeClassName from the parent node of the input.
         * We need to unset activeClassName only if the data was empty.
         * e.g. in the line style of the mk-contact-form, we set labels position based on activeClassName.
         */
        function unsetActiveClass() {
            if (this.value === '') {
                removeClass(this.parentNode, activeClassName);
            }
        }

        /**
         * Add event listeners (focus,blur) for input to set and unset activeClassName.
         *
         * @param input
         */
        function markActiveClass(input) {
            input.addEventListener('focus', setActiveClass);
            input.addEventListener('blur', unsetActiveClass);
        }
    }

    /**
     * Validate form when it's submitted. If everything was valid, we with post form in ajax request.
     *
     * @param e
     * @param invalidClassName
     */
    function validateForm(e, invalidClassName) {
        e.preventDefault();
        var form = e.target || e.srcElement;
        var inputs = getFormInputs(form);
        var isValidForm = true;
        var hasCaptchaField = false;

        for (var i = 0; i < inputs.length; i++) {
            var input = inputs[i];
            input.value = String(input.value).trim();
            switch (input.type) {
                case 'hidden':
                    break;
                case 'email':
                    isValidForm = validateEmail(input, invalidClassName) && isValidForm;
                    break;
                case 'textarea':
                    isValidForm = validateText(input, invalidClassName) && isValidForm;
                    break;
                case 'text':
                    /**
                     * Some old browsers such as IE 8 and 9 detect email type as text.
                     * So, we need to extra check for data-type attribute
                     */
                    if (input.dataset.type === 'captcha') {
                        isValidForm = validateText(input, invalidClassName) && isValidForm;
                        hasCaptchaField = true;
                    } else if (input.dataset.type === 'email') {
                        isValidForm = validateEmail(input, invalidClassName) && isValidForm;
                    } else {
                        isValidForm = validateText(input, invalidClassName) && isValidForm;
                    }
                    break;
                default:
                    /**
                     * e.g. validating for radiobox, selectbox and etc.
                     */
                    console.warn('Implement validation for ' + input.name + ':' + input.type);
                    break;
            }
        }

        if (isValidForm) {
            if (hasCaptchaField) {
                validateCaptcha(form, invalidClassName, sendForm);
            } else {
                sendForm(form);
            }
        }
    }

    /**
     * Validate captcha of form. If everything was, we will execute captchaIsValidCallback which as sendForm().
     *
     * @param form
     * @param invalidClassName
     * @param captchaIsValidCallback
     * @returns boolean
     */
    function validateCaptcha(form, invalidClassName, captchaIsValidCallback) {
        var input = form.querySelectorAll('[data-type="captcha"]')[0];

        if (input.value.length === 0) {
            addClass(input, invalidClassName);
            return false;
        } else {
            window.get.captcha(input.value).done(function (data) {
                loadCaptcha();
                input.value = '';

                if (data !== 'ok') {
                    addClass(input, invalidClassName);
                    addClass(input, 'contact-captcha-invalid');
                    removeClass(input, 'contact-captcha-valid');
                    input.placeholder = mk_captcha_invalid_txt;
                } else {
                    removeClass(input, invalidClassName);
                    removeClass(input, 'contact-captcha-invalid');
                    addClass(input, 'contact-captcha-valid');
                    input.placeholder = mk_captcha_correct_txt;
                    captchaIsValidCallback(form);
                }
            });
        }
    }

    /**
     * Send submitted form.
     *
     * @param form
     */
    function sendForm(form) {
        var $form = $(form);
        var data = getFormData(form);

        progressButton.loader($form);
        $.post(ajaxurl, data, function (response) {
            var res = JSON.parse(response);
            if (res.action_Status) {
                progressButton.success($form);
                $form.find('.text-input').val('');
                $form.find('textarea').val('');
                $form.find('.contact-form-message').addClass('state-success').html(res.message);
            } else {
                progressButton.error($form);
                $form.find('.contact-form-message').removeClass('state-success').html(res.message);
            }
        });
    }

    /**
     * Initialize all captcha images for first time. All captcha images is always same. e.g. if we have multiple form,
     * all of them will have the same image.
     * It will also add event listener for '.captcha-change-image' objects to reload the captcha.
     */
    function initializeCaptchas() {
        loadCaptcha();

        var captchaChangeImageButtons = document.getElementsByClassName('captcha-change-image');
        for (var i = 0; i < captchaChangeImageButtons.length; i++) {
            captchaChangeImageButtons[i].addEventListener('click', loadCaptcha);
        }
    }

    /**
     * Load captcha text and append the image to captcha container.
     * If it used as a callback, it will prevent default behave of the event.
     * e.g. loading new captcha by click on <a> without changing url.
     */
    function loadCaptcha(e) {
        if (e) {
            e.preventDefault();
        }

        $.post(ajaxurl, {action: 'mk_create_captcha_image'}, appendImage);

        /**
         * The callback function for append or change old image src based on response. T
         * The captchaImageURL is the url of the captcha which is provided in ajax response of mk_create_captcha_image.
         * @param captchaImageURL
         */
        function appendImage(captchaImageURL) {
            if (captchaImageHolder.find('.captcha-image').length === 0) {
                captchaImageHolder.append('<img src="' + captchaImageURL + '" class="captcha-image" alt="captcha txt">');
            } else {
                captchaImageHolder.find('.captcha-image').attr("src", captchaImageURL);
            }
        }
    }


    /**
     * Get form inputs using querySelectorAll().
     * It returns <input> and <textarea> tags. If you need any other tags such as <select>, please update this function.
     *
     * @param form
     * @returns {NodeList}
     */
    function getFormInputs(form) {
        return form.querySelectorAll('input,textarea');
    }


    /**
     * Get data of the form inputs and textareas as a object.
     *
     * @param form
     * @returns {{action: string}}
     */
    function getFormData(form) {
        var data = {action: 'mk_contact_form'};
        var inputs = getFormInputs(form);
        for (var i = 0; i < inputs.length; i++) {
            data[inputs[i].name] = inputs[i].value;
        }
        return data;
    }
}


/* Ajax Login Form */
/* -------------------------------------------------------------------- */

function mk_login_form() {

}


/* Progress Button */
/* -------------------------------------------------------------------- */

var progressButton = {
    loader: function (form) {
        MK.core.loadDependencies([MK.core.path.plugins + 'tweenmax.js'], function () {
            var $form = form,
                progressBar = $form.find(".mk-progress-button .mk-progress-inner"),
                buttonText = $form.find(".mk-progress-button .mk-progress-button-content"),
                progressButton = new TimelineLite();

            progressButton
                .to(progressBar, 0, {
                    width: "100%",
                    scaleX: 0,
                    scaleY: 1
                })
                .to(buttonText, .3, {
                    y: -5
                })
                .to(progressBar, 1.5, {
                    scaleX: 1,
                    ease: Power2.easeInOut
                }, "-=.1")
                .to(buttonText, .3, {
                    y: 0
                })
                .to(progressBar, .3, {
                    scaleY: 0
                });
        });
    },

    success: function (form) {
        MK.core.loadDependencies([MK.core.path.plugins + 'tweenmax.js'], function () {
            var $form = form,
                buttonText = $form.find(".mk-button .mk-progress-button-content, .mk-contact-button .mk-progress-button-content"),
                successIcon = $form.find(".mk-progress-button .state-success"),
                progressButtonSuccess = new TimelineLite({
                    onComplete: hideSuccessMessage
                });

            progressButtonSuccess
                .to(buttonText, .3, {
                    paddingRight: 20,
                    ease: Power2.easeInOut
                }, "+=1")
                .to(successIcon, .3, {
                    opacity: 1
                })
                .to(successIcon, 2, {
                    opacity: 1
                });

            function hideSuccessMessage() {
                progressButtonSuccess.reverse()
            }
        });
    },

    error: function (form) {
        MK.core.loadDependencies([MK.core.path.plugins + 'tweenmax.js'], function () {
            var $form = form,
                buttonText = $form.find(".mk-button .mk-progress-button-content, .mk-contact-button .mk-progress-button-content"),
                errorIcon = $form.find(".mk-progress-button .state-error"),
                progressButtonError = new TimelineLite({
                    onComplete: hideErrorMessage
                });

            progressButtonError
                .to(buttonText, .3, {
                    paddingRight: 20
                }, "+=1")
                .to(errorIcon, .3, {
                    opacity: 1
                })
                .to(errorIcon, 2, {
                    opacity: 1
                });

            function hideErrorMessage() {
                progressButtonError.reverse()
            }
        });
    }
};
function mk_click_events() {
  "use strict";

  var eventtype = 'click'; 

  $(".mk-header-login, .mk-header-signup, .mk-side-dashboard, .mk-quick-contact-wrapper, .mk-dashboard-trigger, .blog-share-container, .news-share-buttons, .main-nav-side-search, #mk-fullscreen-search-wrapper, #fullscreen-navigation").on(eventtype, function(event) {
    if (event.stopPropagation) {
      event.stopPropagation();
    } else if (window.event) {
      window.event.cancelBubble = true;
    }
  });
  $("html").on(eventtype, function() {
    $(".mk-login-register, .mk-header-subscribe, #mk-quick-contact, .single-share-buttons, .single-share-box, .blog-social-share, .news-share-buttons, #mk-nav-search-wrapper").fadeOut(300);
    $('.mk-quick-contact-link').removeClass('quick-contact-active');
    // Removed By Maki for repairing fullnav scroll issue. Hope it odesnt break anything
    // $('body').css('overflow', 'visible');
  });

  $('.mk-fullscreen-search-overlay').on(eventtype,function(){
    $(this).removeClass('mk-fullscreen-search-overlay-show');
  });

  $('.mk-forget-password').on(eventtype, function() {
    $('.mk-forget-panel').siblings().hide().end().show();
  });

  $('.mk-create-account').on(eventtype, function() {
    $('#mk-register-panel').siblings().hide().end().show();
  });

  $('.mk-return-login').on(eventtype, function() {
    $('#mk-login-panel').siblings().hide().end().show();
  });


  $('.mk-quick-contact-link').on(eventtype, function() {
    var $this = $(this),
        $quickContact = $('#mk-quick-contact');
    if (!$this.hasClass('quick-contact-active')) {
      $quickContact.addClass('quick-contact-anim').fadeIn(250);
      $this.addClass('quick-contact-active');
    } else {
      $quickContact.removeClass('quick-contact-anim').fadeOut(100);
      $this.removeClass('quick-contact-active');
    }
    return false;
  });

}

function mk_social_share_global() {

  "use strict";

  var eventtype = 'click';

  $('.twitter-share').on(eventtype, function() {
    var $this = $(this),
        $url = $this.attr('data-url'),
        $title = $this.attr('data-title');

    window.open('http://twitter.com/intent/tweet?text=' + $title + ' ' + $url, "twitterWindow", "height=380,width=660,resizable=0,toolbar=0,menubar=0,status=0,location=0,scrollbars=0");
    return false;
  });

  $('.pinterest-share').on(eventtype, function() {
    var $this = $(this),
        $url = $this.attr('data-url'),
        $title = $this.attr('data-title'),
        $image = $this.attr('data-image');
    window.open('http://pinterest.com/pin/create/button/?url=' + $url + '&media=' + $image + '&description=' + $title, "twitterWindow", "height=320,width=660,resizable=0,toolbar=0,menubar=0,status=0,location=0,scrollbars=0");
    return false;
  });

  $('.facebook-share').on(eventtype, function() {
    var $url = $(this).attr('data-url');
    window.open('https://www.facebook.com/sharer/sharer.php?u=' + $url, "facebookWindow", "height=380,width=660,resizable=0,toolbar=0,menubar=0,status=0,location=0,scrollbars=0");
    return false;
  });

  $('.googleplus-share').on(eventtype, function() {
    var $url = $(this).attr('data-url');
    window.open('https://plus.google.com/share?url=' + $url, "googlePlusWindow", "height=380,width=660,resizable=0,toolbar=0,menubar=0,status=0,location=0,scrollbars=0");
    return false;
  });

  $('.linkedin-share').on(eventtype, function() {
    var $this = $(this),
        $url = $this.attr('data-url'),
        $title = $this.attr('data-title'),
        $desc = $this.attr('data-desc');
    window.open('http://www.linkedin.com/shareArticle?mini=true&url=' + $url + '&title=' + $title + '&summary=' + $desc, "linkedInWindow", "height=380,width=660,resizable=0,toolbar=0,menubar=0,status=0,location=0,scrollbars=0");
    return false;
  });
}


/* Event Count Down */
/* -------------------------------------------------------------------- */

function mk_event_countdown() {
  if ($.exists('.mk-event-countdown')) {

    MK.core.loadDependencies([ MK.core.path.plugins + 'jquery.countdown.js' ], function() {

      $('.mk-event-countdown').each(function () {
        if (isTest) return;
        var $this = $(this),
          $date = $this.attr('data-date'),
          $offset = $this.attr('data-offset');

        $this.downCount({
          date: $date,
          offset: $offset
        });
      });
      
    });
  }
}
/* Flexslider init */
/* -------------------------------------------------------------------- */

function mk_flexslider_init() {

  var $lcd = $('.mk-lcd-slideshow'),
      $laptop = $('.mk-laptop-slideshow-shortcode');

  if($lcd.length) $lcd.find('.mk-lcd-image').fadeIn();
  if($laptop.length) $laptop.find(".mk-laptop-image").fadeIn();

  $('.js-flexslider').each(function () {

    if ($(this).parents('.mk-tabs').length || $(this).parents('.mk-accordion').length) {
      $(this).removeData("flexslider");
    }

    var $this = $(this),
      $selector = $this.attr('data-selector'),
      $animation = $this.attr('data-animation'),
      $easing = $this.attr('data-easing'),
      $direction = $this.attr('data-direction'),
      $smoothHeight = $this.attr('data-smoothHeight') == "true" ? true : false,
      $slideshowSpeed = $this.attr('data-slideshowSpeed'),
      $animationSpeed = $this.attr('data-animationSpeed'),
      $controlNav = $this.attr('data-controlNav') == "true" ? true : false,
      $directionNav = $this.attr('data-directionNav') == "true" ? true : false,
      $pauseOnHover = $this.attr('data-pauseOnHover') == "true" ? true : false,
      $isCarousel = $this.attr('data-isCarousel') == "true" ? true : false;


    if ($selector !== undefined) {
      var $selector_class = $selector;
    } else {
      var $selector_class = ".mk-flex-slides > li";
    }

    if ($isCarousel === true) {
      var $itemWidth = parseInt($this.attr('data-itemWidth')),
        $itemMargin = parseInt($this.attr('data-itemMargin')),
        $minItems = parseInt($this.attr('data-minItems')),
        $maxItems = parseInt($this.attr('data-maxItems')),
        $move = parseInt($this.attr('data-move'));
    } else {
      var $itemWidth = $itemMargin = $minItems = $maxItems = $move = 0;
    }

    MK.core.loadDependencies([ MK.core.path.plugins + 'jquery.flexslider.js' ], function() {
      $this.flexslider({
        selector: $selector_class,
        animation: $animation,
        easing: $easing,
        direction: $direction,
        smoothHeight: $smoothHeight,
        slideshow: !isTest, // autoplay
        slideshowSpeed: $slideshowSpeed,
        animationSpeed: $animationSpeed,
        controlNav: $controlNav,
        directionNav: $directionNav,
        pauseOnHover: $pauseOnHover,
        prevText: "",
        nextText: "",
        itemWidth: $itemWidth,
        itemMargin: $itemMargin,
        minItems: $minItems,
        maxItems: $maxItems,
        move: $move
      });
    });

  });

}

/* Header Search Form */
/* -------------------------------------------------------------------- */

function mk_header_searchform() {

  $('.mk-search-trigger').click(function(){
    setTimeout(function() {
        $('#mk-ajax-search-input').focus();
    },500);
  });

  "use strict";

  $('.mk-header-toolbar .mk-header-searchform .text-input').on('focus', function () {

    if ($('.mk-header-toolbar .mk-header-searchform .text-input').hasClass('on-close-state')) {
      $('.mk-header-toolbar .mk-header-searchform .text-input').removeClass('on-close-state').animate({
        'width': '200px'
      }, 200);
      return false;
    }
  });

  $(".mk-header-toolbar .mk-header-searchform").click(function (event) {
    if (event.stopPropagation) {
      event.stopPropagation();
    } else if (window.event) {
      window.event.cancelBubble = true;
    }
  });


  $("html").click(function () {
    $(this).find(".mk-header-toolbar .mk-header-searchform .text-input").addClass('on-close-state').animate({
      'width': 90
    }, 300);
  });

}




/* Hover Events */
/* -------------------------------------------------------------------- */

function mk_hover_events() {

  "use strict";

  $('.shopping-cart-header').hover(
    function() {
      $(this).find('.mk-shopping-cart-box').stop(true, true).fadeIn(250);
    },
    function() {
      $(this).find('.mk-shopping-cart-box').stop(true, true).fadeOut(250);
    }
  );


  $('.widget-sub-navigation > ul > li, .widget_nav_menu ul.menu > li, .widget_product_categories ul > .cat-item').each(function() {

    var $this = $(this),
        $subLevel = $this.find('ul').first();

    if ($this.hasClass('page_item_has_children') || $this.hasClass('menu-item-has-children') || $this.hasClass('cat-parent')) {
      $this.on('click', function() {
        if($this.hasClass('toggle-active')) {
            $subLevel.stop(true, true).slideUp(700);  
            $this.removeClass('toggle-active');
        } else {
            $subLevel.stop(true, true).slideDown(700);
            $this.addClass('toggle-active');
        }
      }); 
    }

  });  

  // var eventtype = mobilecheck() ? 'touchstart' : 'click';
  var eventtype = 'click';
  
  $('.mk-fullscreen-trigger').on(eventtype, function(e) {
    $('.mk-fullscreen-search-overlay').addClass('mk-fullscreen-search-overlay-show');
    setTimeout(function(){
      $("#mk-fullscreen-search-input").focus();
    }, 300);
    e.preventDefault();
  });

  $('.mk-fullscreen-close').on(eventtype, function(e) {
    $('.mk-fullscreen-search-overlay').removeClass('mk-fullscreen-search-overlay-show');
    e.preventDefault();
  });

}

function mk_unfold_footer() {
  var $this = $('#mk-footer'),
      $spacer = $('#mk-footer-unfold-spacer'),
      $footerHeight = $this.outerHeight();

  // Stick with CSS media query breakpoint to target exact screen width
  if( !window.matchMedia("(max-width: 767px)").matches ) {
      if ($this.hasClass('mk-footer-unfold')) {
        $spacer.css('height', $footerHeight);
      }
  } else {
     $spacer.css('height', 0);
  }
}
/* jQuery fancybox lightbox */
/* -------------------------------------------------------------------- */
function mk_lightbox_init() {

var $lightbox = $(".mk-lightbox");

  $lightbox.fancybox({
            padding: 15,
            margin: 15, 

            width: 800,
            height: 600,
            minWidth: 100,
            minHeight: 100,
            maxWidth: 9999,
            maxHeight: 9999,
            pixelRatio: 1, // Set to 2 for retina display support

            autoSize: true,
            autoHeight: false,
            autoWidth: false,

            autoResize: true,
            fitToView: true,
            aspectRatio: false,
            topRatio: 0.5,
            leftRatio: 0.5,

            scrolling: 'auto', // 'auto', 'yes' or 'no'
            wrapCSS: '',

            arrows: true,
            closeBtn: true,
            closeClick: false,
            nextClick: false,
            mouseWheel: true,
            autoPlay: false,
            playSpeed: 3000,
            preload: 3,
            modal: false,
            loop: true,
            // Properties for each animation type
            // Opening fancyBox
            openEffect: 'fade', // 'elastic', 'fade' or 'none'
            openSpeed: 200,
            openEasing: 'swing',
            openOpacity: true,
            openMethod: 'zoomIn',

            // Closing fancyBox
            closeEffect: 'fade', // 'elastic', 'fade' or 'none'
            closeSpeed: 200,
            closeEasing: 'swing',
            closeOpacity: true,
            closeMethod: 'zoomOut',

            // Changing next gallery item
            nextEffect: 'none', // 'elastic', 'fade' or 'none'
            nextSpeed: 350,
            nextEasing: 'swing',
            nextMethod: 'changeIn',

            // Changing previous gallery item
            prevEffect: 'none', // 'elastic', 'fade' or 'none'
            prevSpeed: 350,
            prevEasing: 'swing',
            prevMethod: 'changeOut',
            helpers : {
                media : {},
                overlay: {
                  locked: true 
                }
            },

            tpl: {
                wrap: '<div class="fancybox-wrap" tabIndex="-1"><div class="fancybox-skin"><div class="fancybox-outer"><div class="fancybox-inner"></div></div></div></div>',
                image: '<img class="fancybox-image" src="{href}" alt="" />',
                error: '<p class="fancybox-error">The requested content cannot be loaded.<br/>Please try again later.</p>',
                closeBtn: '<a title="Close" class="fancybox-item fancybox-close" href="javascript:;"><i><svg class="mk-svg-icon" svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M390.628 345.372l-45.256 45.256-89.372-89.373-89.373 89.372-45.255-45.255 89.373-89.372-89.372-89.373 45.254-45.254 89.373 89.372 89.372-89.373 45.256 45.255-89.373 89.373 89.373 89.372z"/></svg></i></a>',
                next: '<a title="Next" class="fancybox-nav fancybox-next" href="javascript:;"><span><i><svg class="mk-svg-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M144 505.6c8 0 16-3.2 22.4-8l240-225.6c6.4-6.4 9.6-14.4 9.6-22.4s-3.2-16-9.6-22.4l-240-224c-12.8-12.8-32-12.8-44.8 0s-11.2 32 1.6 44.8l214.4 201.6-216 203.2c-12.8 11.2-12.8 32 0 44.8 6.4 4.8 14.4 8 22.4 8z"/></svg></i></span></a>',
                prev: '<a title="Previous" class="fancybox-nav fancybox-prev" href="javascript:;"><span><i><svg class="mk-svg-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M368 505.6c-8 0-16-3.2-22.4-8l-240-225.6c-6.4-6.4-9.6-14.4-9.6-24 0-8 3.2-16 9.6-22.4l240-224c12.8-11.2 33.6-11.2 44.8 1.6 12.8 12.8 11.2 32-1.6 44.8l-214.4 201.6 216 203.2c12.8 11.2 12.8 32 0 44.8-4.8 4.8-14.4 8-22.4 8z"/></svg></i></span></a>',
                loading: '<div id="fancybox-loading"><div></div></div>'
            },

            afterLoad: function() {
                $('html').addClass('fancybox-lock');
                $('.fancybox-wrap').appendTo('.fancybox-overlay');
            }

        });
}


/* Love This */
/* -------------------------------------------------------------------- */

function mk_love_post() {

  "use strict";

  $('body').on('click', '.mk-love-this', function () {
    var $this = $(this),
      $id = $this.attr('id');

    if ($this.hasClass('item-loved')) return false;

    if ($this.hasClass('item-inactive')) return false;

    var $sentdata = {
      action: 'mk_love_post',
      post_id: $id
    }

    $.post(ajaxurl, $sentdata, function (data) {
      $this.find('.mk-love-count').html(data);
      $this.addClass('item-loved');
    });

    $this.addClass('item-inactive');
    return false;
  });

}




/* Milestone Number Shortcode */
/* -------------------------------------------------------------------- */

function mk_milestone() {

  "use strict";

  if( isTest || !$.exists('.mk-milestone') ) return;

  $('.mk-milestone').each(function () {
    var $this = $(this),
      stop_number = $this.find('.milestone-number').attr('data-stop'),
      animation_speed = parseInt($this.find('.milestone-number').attr('data-speed'));

    var build = function() {
      if (!$this.hasClass('scroll-animated')) {
        $this.addClass('scroll-animated');

        $({
          countNum: $this.find('.milestone-number').text()
        }).animate({
          countNum: stop_number
        }, {
          duration: animation_speed,
          easing: 'linear',
          step: function () {
            $this.find('.milestone-number').text(Math.floor(this.countNum));
          },
          complete: function () {
            $this.find('.milestone-number').text(this.countNum);
          }
        });
      }
    };

    if ( !MK.utils.isMobile() ) {
      // refactored only :in-viewport logic. rest is to-do
      MK.utils.scrollSpy( this, {
          position: 'bottom',
          after: build
      });
    } else {
      build();
    }

  });

}




/* Recent Works Widget */
/* -------------------------------------------------------------------- */

function mk_portfolio_widget() {

  "use strict";

  $('.widget_recent_portfolio li').each(function () {

    $(this).find('.portfolio-widget-thumb').hover(function () {

      $(this).siblings('.portfolio-widget-info').animate({
        'opacity': 1
      }, 200);
    }, function () {

      $(this).siblings('.portfolio-widget-info').animate({
        'opacity': 0
      }, 200);
    });

  });
}



/* Skill Meter and Charts */
/* -------------------------------------------------------------------- */
function mk_skill_meter() {
    "use strict";
    if ($.exists('.mk-skill-meter')) {
        if (!MK.utils.isMobile()) {
            $(".mk-skill-meter .progress-outer").each(function() {
                var $this = $(this);

                var build = function() {
                    if (!$this.hasClass('scroll-animated')) {
                        $this.addClass('scroll-animated');
                        $this.animate({
                            width: $this.attr("data-width") + '%'
                        }, 2000);
                    }
                };

                MK.utils.scrollSpy( this, {
                    position: 'bottom',
                    after: build
                });
            });
        } else {
            $(".mk-skill-meter .progress-outer").each(function() {
                var $this = $(this);
                if (!$this.hasClass('scroll-animated')) {
                    $this.addClass('scroll-animated');
                    $this.css({
                        width: $(this).attr("data-width") + '%'
                    });
                }
            });
        }
    }
}

// function mk_charts() {
//     "use strict";

//     if( !$.exists('.mk-chart') ) return;

//     MK.core.loadDependencies([ MK.core.path.plugins + 'jquery.easyPieChart.js' ], function() {

//         $('.mk-chart').each(function() {

//             var $this = $(this),
//                 $parent_width = $(this).parent().width(),
//                 $chart_size = parseInt($this.attr('data-barSize'));

//             if ($parent_width < $chart_size) {
//                 $chart_size = $parent_width;
//                 $this.css('line-height', $chart_size);
//                 $this.find('i').css({
//                     'line-height': $chart_size + 'px'
//                 });
//                 $this.css({
//                     'line-height': $chart_size + 'px'
//                 });
//             }

//             var build = function() {
//                 $this.easyPieChart({
//                     animate: 1300,
//                     lineCap: 'butt',
//                     lineWidth: $this.attr('data-lineWidth'),
//                     size: $chart_size,
//                     barColor: $this.attr('data-barColor'),
//                     trackColor: $this.attr('data-trackColor'),
//                     scaleColor: 'transparent',
//                     onStep: function(value) {
//                         this.$el.find('.chart-percent span').text(Math.ceil(value));
//                     }
//                 });
//             };

//             // refactored only :in-viewport logic. rest is to-do
//             MK.utils.scrollSpy( this, {
//                 position: 'bottom',
//                 after: build
//             });


//         });
//     });
// }
/* Toolbar subscribe form */
/* -------------------------------------------------------------------- */

$( "#mc-embedded-subscribe-form" ).submit(function( e ){
    var $this = $(this);
  
    e.preventDefault();
    $.ajax({
        url: MK.core.path.ajaxUrl,
        type: "POST",
        data: {
            action: "mk_ajax_subscribe",
            email: $this.find( ".mk-subscribe--email" ).val(),
            list_id: $this.find( ".mk-subscribe--list-id" ).val(),
            optin: $this.find( ".mk-subscribe--optin" ).val()
        },
        success: function ( res ) {
            $this.parent().find( ".mk-subscribe--message" ).html( $.parseJSON( res ).message );
        }
    });
});
/**
 * Add class to tag. It's vanilla js instead of jQuery.
 * @param tag
 * @param className
 */
function addClass(tag, className) {
    tag.className += ' ' + className;
}

/**
 * Remove class from tag. It's vanilla js instead of jQuery.
 * Replacing should be with g for replacing all occurrence.
 *
 * @param tag
 * @param className
 */
function removeClass(tag, className) {
    tag.className = tag.className.replace(new RegExp(className, 'g'), '');
}


/**
 * If we're running under Node for testing purpose.
 */
if(typeof exports !== 'undefined') {
    exports.addClass = addClass;
    exports.removeClass = removeClass;
}
/**
 * Validate email address.
 *
 * @param input
 * @param invalidClassName
 * @returns boolean
 */
function validateEmail(input, invalidClassName) {
    var value = input.value.trim();
    if ((input.required || value.length > 0) && !/^([a-z0-9_\.\-\+]+)@([\da-z\.\-]+)\.([a-z\.]{2,63})$/i.test(value)) {
        if (invalidClassName) {
            addClass(input, invalidClassName);
        }
        return false;
    } else {
        if (invalidClassName) {
            removeClass(input, invalidClassName);
        }
        return true;
    }
}

/**
 * Validate text entry.
 *
 * @param input
 * @param invalidClassName
 * @returns boolean
 */
function validateText(input, invalidClassName) {
    var value = input.value.trim();

    if (input.required && value.length === 0) {
        if (invalidClassName) {
            addClass(input, invalidClassName);
        }
        return false;
    } else {
        if (invalidClassName) {
            removeClass(input, invalidClassName);
        }
        return true;
    }
}


/**
 * If we're running under Node for testing purpose.
 */
if(typeof exports !== 'undefined') {
    exports.validateEmail = validateEmail;
    exports.validateText = validateText;
}
(function( $ ) {
	'use strict';

    var $wrapper = $('.js-bottom-corner-btns');
    var $contactBtn = $wrapper.find('.js-bottom-corner-btn--contact');
    var $backBtn = $wrapper.find('.js-bottom-corner-btn--back');
    var hasContactBtn = $contactBtn.length;
    var hasBackBtn = $backBtn.length;

    if(!hasBackBtn) return;

    function deactivate() {
        $contactBtn.removeClass('is-active');
        $backBtn.removeClass('is-active');
    }

    function activate() { 
        $contactBtn.addClass('is-active');
        $backBtn.addClass('is-active');
    }

    MK.utils.scrollSpy( 400, {
        before: deactivate,
        after: activate
    });

})( jQuery );
(function($) {
	'use strict';

    $('.mk-fullscreen-nav-close, .mk-fullscreen-nav-wrapper, #fullscreen-navigation a').on('click', function(e) {

    	// Close nav with removing classes
	    $('.mk-fullscreen-nav').removeClass('opened');
	    $('.mk-dashboard-trigger').removeClass('fullscreen-active');
	    $('body').removeClass('fullscreen-nav-opened'); 

		var anchor = MK.utils.detectAnchor( this ),
	        $this = $( this );

	    // Scroll to anchor if exists
		if( anchor.length ) {
			e.preventDefault();
			MK.utils.scrollToAnchor( anchor );

		// Or do nothing if pointless # as href
		// BAD  PRACTICE: it is very popular to use "#" for click elements that we listen to with js.
		// GOOD PRACTICE: prefer "javascript:;" as easier to handle and more readable version
		} else if( $this.attr( 'href' ) === '#' ) {
	        e.preventDefault();
	    }
    });

}(jQuery));
(function($) {
	'use strict';

	/**
     * Mega menu
     */
    var $navList = $(".main-navigation-ul");
    var megaMenu = function megaMenu() {

        $navList.MegaMenu({
            type: "vertical",
            delay: 200
        });
    };

    $(window).on('load', megaMenu);

}(jQuery));
(function($) {
	'use strict';

	/**
     * One pager menu hash update. 
     * Smooth scroll is appended globally whenever the click element has corresponding #el
     */    
    var onePageNavItem = function onePageNavItem() {
        var $this = $( this ),
            link = $this.find( 'a' ),
            anchor = MK.utils.detectAnchor( link ); // anchor on current page

        if( !anchor.length ) return;

        $this.removeClass( 'current-menu-item current-menu-ancestor current-menu-parent' );

        var activeNav = function( state ) {
            return function() {
                $this[ state ? 'addClass' : 'removeClass' ]( 'current-menu-item' );
                window.history.replaceState( undefined, undefined, [ state ? anchor : ' ' ] );
            };
        };

        MK.utils.scrollSpy( $( anchor )[0], {
            before : activeNav( false ),
            active : activeNav( true ),
            after  : activeNav( false ),
        });
    };

    var $navItems = $('.js-main-nav').find( 'li' );
    
    $(window).on('load', function() {
        // Wait with spying anchors so we do not assign anchor that is browser scroll to after page load
        // Especially when there are anchors on top - refreshing page can cause grabbing one of them into url
        // and force unwanted scroll
        setTimeout(function() {
            $navItems.each( onePageNavItem );
        }, 1000);
    });
	
}(jQuery));
(function($) {
    'use strict';

    var $window = $(window);
    var $body = $('body');
    var $resMenuWrap = $('.mk-responsive-wrap');
    var $post_nav = $('.mk-post-nav');
    var $toolbar = $('.mk-header-toolbar');
    var $resMenuLink = $('.mk-nav-responsive-link');

    // Flags
    var hasResMenu = ($resMenuWrap.length > 0);

    //initial window and screen height
    var windowHeight = $window.height();
    var screenHeight = screen.height;

    // We keep this handler above hasResMenu flag.
    // Even if our header doesn't contain droppable responsive menu (in favor of fullscreen or side menu) 
    // we still transform tollbar into collapsible menu part in responsive state
    $('.mk-toolbar-resposnive-icon').on('click', function(e) {
        e.preventDefault();
        console.log('clicked');
        if ($body.hasClass('toolbar-opened')) {
            $body.removeClass('toolbar-opened').addClass('toolbar-closed');
            $toolbar.hide();
        } else {
            $body.removeClass('toolbar-closed').addClass('toolbar-opened');
            $toolbar.show();
        }
    });


    if (!hasResMenu) return;

    function toggleResMenu(e) {
        e.preventDefault();
        var $this = $(this);
        var $headerInner = $this.parents('header');
        var $resMenu = $headerInner.find('.mk-responsive-wrap');
        var searchBox = $('.responsive-searchform .text-input');

        if ($body.hasClass('mk-opened-nav')) {
            $this.removeClass('is-active');
            $body.removeClass('mk-opened-nav').addClass('mk-closed-nav').trigger('mk-closed-nav');
            $resMenu.hide();
            $post_nav.removeClass('post-nav-backward');
        } else {
            $this.addClass('is-active');
            $body.removeClass('mk-closed-nav').addClass('mk-opened-nav').trigger('mk-opened-nav');
            $resMenu.show();
            $post_nav.addClass('post-nav-backward');

            var offset = $headerInner.offset().top;
            var headerHeight = MK.val.offsetHeaderHeight(offset);
            MK.utils.scrollTo(offset - headerHeight + 5);
        }

        //for iPhone 5 focus bug , remove search box focused class
        if(searchBox.hasClass('input-focused')){
            searchBox.removeClass('input-focused');
        }
        
    }

    $resMenuLink.each(function() {
        $(this).on('click', toggleResMenu);
    });


    var setResMenuHeight = function() {
        var height = $window.height() - MK.val.offsetHeaderHeight(0);
        $resMenuWrap.css('max-height', height);
    };

    setResMenuHeight();
    $window.on('resize', setResMenuHeight);

    // check if device virtual keyboard is active 
    var isVirtualKeyboard = function() {
        var currentWindowHeight = $window.height();
        var currentScreenHeight = screen.height;
        var searchBox = $('.responsive-searchform .text-input');
        var searchBoxIsFocused = false; 

        //for iPhone 5 focus bug , add class for detect focus state
        searchBox.on('touchstart touchend', function(e) {
            searchBox.addClass('input-focused');
        });

        searchBoxIsFocused = (searchBox.is(':focus') || searchBox.hasClass("input-focused"));

        if ($body.hasClass('mk-opened-nav') && searchBoxIsFocused && currentScreenHeight == screenHeight && currentWindowHeight != windowHeight) {
            return true;
        } else {
            return false;
        }
    };

    var hideResMenu = function hideResMenu() {
        if (MK.utils.isResponsiveMenuState()) {

            //when search box in responsive menu is focused , window resize fired but at this time responsive menu should be open
            if (!isVirtualKeyboard()) {
                // hide toggled menu and its states
                if ($body.hasClass('mk-opened-nav')) {
                    $resMenuLink.filter('.is-active').trigger('click');
                }
                // hide menu wrapper
                $resMenuWrap.hide();

            }
        }
    };

    $window.on('resize', hideResMenu);
    $resMenuWrap.on('click', 'a', hideResMenu);

}(jQuery));

(function($) {
	'use strict';

    var $header = $('.mk-header');    
    var hasHeader = ($header.length > 0);

    if(!hasHeader) return;
    
    var $sticky_style = $header.attr('data-header-style');

    //if ($sticky_style !== 3) return;

    $('.sidedash-navigation-ul > li').each(function() {
        var $this = $(this);

        $this.children('ul').siblings('a').after('<span class="mk-nav-arrow mk-nav-sub-closed"><svg class="mk-svg-icon" data-name="mk-moon-arrow-down" data-cacheid="2" style=" height:14px; width: 14px; " xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M512 192l-96-96-160 160-160-160-96 96 256 255.999z"></path></svg></span>');
    });

    $('.mk-nav-arrow').stop(true).on('click', function(e) {
        e.preventDefault();
        var $this = $(this);
        
        if ($this.hasClass('mk-nav-sub-closed')) {
            $this.siblings('ul').slideDown(450).end().removeClass('mk-nav-sub-closed').addClass('mk-nav-sub-opened');
        } else {
            $this.siblings('ul').slideUp(450).end().removeClass('mk-nav-sub-opened').addClass('mk-nav-sub-closed');
        }
    });
   
    $('.mk-dashboard-trigger').on('click', function(e) {
        var $this = $(this),
            $body = $('body'),
            $fullscreen_box = $('.mk-fullscreen-nav');

        if ($this.hasClass('dashboard-style')){
          if (!$this.hasClass('dashboard-active')) {
            $this.addClass('dashboard-active');
            $body.addClass('dashboard-opened');
          } else {
            $this.removeClass('dashboard-active'); 
            $body.removeClass('dashboard-opened');
          }
        }else if($this.hasClass('fullscreen-style')){
          if (!$this.hasClass('fullscreen-active')) {
            $this.addClass('fullscreen-active');
            $body.addClass('fullscreen-nav-opened');
            $fullscreen_box.addClass('opened');
            // MK.utils.scroll.disable();
          } else {
            $this.removeClass('fullscreen-active');
            $body.removeClass('fullscreen-nav-opened');
            $fullscreen_box.removeClass('opened');
          }
        }

        e.preventDefault();
    });

    $('html').on('click', function() {
        $('body').removeClass('dashboard-opened');
        $('.mk-dashboard-trigger').removeClass('dashboard-active');
    });
	
}(jQuery));
(function($) {
	'use strict';

    /**
     * Vertical menu
     */
    var $verticalMenu = $('#mk-vm-menu');
    var verticalMenu = function verticalMenu() {
        if(!$verticalMenu.data('vertical-menu') && !MK.utils.isResponsiveMenuState()) {
            $verticalMenu.dlmenu();
            $verticalMenu.data('vertical-menu', true);
        }
    };

    verticalMenu();
    $(window).on('resize', verticalMenu);
	
}(jQuery));
(function($) {
    'use strict';

    // WPML
    var $lang_item = $('.mk-main-navigation > .main-navigation-ul > .menu-item-language');
    $lang_item.addClass('no-mega-menu').css('visibility', 'visible');
    $('.mk-main-navigation .menu-item-language > a').addClass('menu-item-link');

})(jQuery);
(function($) {
	'use strict';

    var $header = $( '.mk-header' ).first(); // Theme header is always first, do not apply to shortcode headers.
    var hasHeader = ($header.length > 0);

    if(!hasHeader) return;

    var $window = $( window );
    var $document = $( document );
    var $headerHolder = $header.find( '.mk-header-holder' );
    var $paddingWrapper = $header.find('.mk-header-padding-wrapper');
    var config = $header.data();

    /**
     * Flags
     * @type {Boolean}
     */
    var isStickyLazy = (config.stickyStyle === 'lazy');
    var isStickyFixed = (config.stickyStyle === 'fixed');
    var isStickySlide = (config.stickyStyle === 'slide');
    
    function isSticky() { // Check for sticky compatibility
        //return config.headerStyle !== 4; header style 4 needs sticky state for transparent header. 
        return true;
    }
    
    function isColorable() { // Check for coloring compatibility
        // TODO make it explicit in DOM that header is transparent as this is only scenario for colorable header
        // Monkey patch - exclude header styles that don't fit colorable
        return config.headerStyle !== 4;
    }
    

    /**
     * Change header skin
     */
	function changeSkin( e, skin ) {
		$header.attr( 'data-transparent-skin', skin );
        // Fix for class based skining
        var contrast = skin === 'light' ? 'dark' : 'light';
        $header.addClass(skin + '-skin');
        $header.removeClass(contrast + '-skin');
	}

    if(isColorable()) MK.utils.eventManager.subscribe( 'firstElSkinChange', changeSkin );


    // Assign sticky scenarions
    if (isSticky() && isStickyLazy) {
      if(config.headerStyle !== 2) {
        lazySticky();
      }
    }
    else if (isSticky() && isStickyFixed) fixedSticky();
    else if (isSticky() && isStickySlide) slideSticky();

    /**
     * Sticky header behavior: Lazy
     */
    function lazySticky() {
        var elClassHidden = 'header--hidden';
        var elClassSticky = 'a-sticky';
        var wScrollCurrent = 0;
        var wScrollBefore = 0;
        var wScrollDiff = 0;
        var wHeight = 0;
        var dHeight = 0;

        var setSizes = function setSizes() {
            dHeight = $document.height();
            wHeight = $window.height();
        };

        var onScroll = function onScroll() { 
            wScrollCurrent = MK.val.scroll();
            wScrollDiff = wScrollBefore - wScrollCurrent;

            if( wScrollCurrent <= 0 ) { // scrolled to the very top; element sticks to the top
                $headerHolder.removeClass( elClassHidden );
                $header.removeClass( elClassSticky );

            } else if( wScrollDiff > 0 && $headerHolder.hasClass( elClassHidden ) ) { // scrolled up; element slides in
                $headerHolder.removeClass( elClassHidden );
                $header.addClass( elClassSticky );

            } else if( wScrollDiff < 0 ) { // scrolled down
                
                if( wScrollCurrent + wHeight >= dHeight && $headerHolder.hasClass( elClassHidden ) ) { // scrolled to the very bottom; element slides in
                    $headerHolder.removeClass( elClassHidden );
                    $header.addClass( elClassSticky );
                } else { // scrolled down; element slides out
                    $headerHolder.addClass( elClassHidden );
                    $header.removeClass( elClassSticky );
                }
            }

            wScrollBefore = wScrollCurrent;
        };

        setSizes();
        onScroll();
        $window.on( 'resize', MK.utils.throttle( 100, setSizes ) );
        $window.on( 'scroll', MK.utils.throttle( 500, onScroll ) );
    }


    /**
     * Sticky header behavior: Fixed
     */
    function fixedSticky() {
        var sticked = false;
        var scrollPos;

        var toggleState = function toggleState() {
            scrollPos = MK.val.scroll() + MK.val.adminbarHeight();

            if( (scrollPos > MK.val.stickyOffset() ) && ! MK.utils.isResponsiveMenuState() ) {
                if(sticked) return; // stop if already sticked
                $header.addClass('a-sticky');
                sticked = true;
            } else {
                if(!sticked) return; // stop if already unsticked
                $header.removeClass('a-sticky');
                sticked = false;
            }
        };

        toggleState();
        $window.on( 'scroll', MK.utils.throttle( 100, toggleState) ); 
        $window.on( 'resize', MK.utils.throttle( 100, toggleState) );
    }


    /**
     * Sticky header behavior: Slide
     */
    function slideSticky() {
        var sticked = false;
        var onScroll = function onScroll() {
            if (MK.val.scroll() > MK.val.stickyOffset()) {
                if(sticked) return; // stop if already sticked
                $header.addClass('pre-sticky');
                $paddingWrapper.addClass('enable-padding');
                setTimeout(function() {
                    $header.addClass('a-sticky');
                }, 1);
                sticked = true;
            } else {
                if(!sticked) return; // stop if already unsticked
                $header.removeClass('a-sticky');
                $header.removeClass('pre-sticky');
                $paddingWrapper.removeClass('enable-padding');
                sticked = false;
            }
        };

        onScroll();
        $window.on( 'scroll', MK.utils.throttle( 100, onScroll) );
    }

    // TODO
    // var pageIntro = $('body').data('intro'); // block scrolling on page intro 


})( jQuery );
(function($){
	'use strict';

	// Do not assign at all if no touch events
	var hasTouchscreen = ('ontouchstart' in document.documentElement);
	if(!hasTouchscreen) return;

	$('.mk-main-navigation .menu-item-has-children').each( normalizeClick );

	function normalizeClick() {
		$(this).on('click', handleClick);
	}

	// Most reasonable way to normalize click and let hover state on first touch yet don't break experience on multiple input devices is to actually check against desired effect.
	// Better way would be to check against expected state but JS doesn't detect :hover so it would be nice to have it normalized globally like expecting .hover class in css
	function handleClick(e) {
		var $this = $(e.currentTarget);
		var $child = $this.find('> ul');
		var isVisible = $child.css('display') !== 'none';

		if(!isVisible) {
			e.preventDefault();
			e.stopPropagation();
		}
	}

}(jQuery));
(function( $ ) {
	'use strict';

	MK.ui.preloader = {
		dom : {
			overlay: '.mk-body-loader-overlay'
		},

		hide : function hide() {
			$( this.dom.overlay ).fadeOut(600, "easeInOutExpo", function() {
				$('body').removeClass('loading');
            //$( this ).remove();
         });
		}
	};  

})( jQuery ); 
(function($) {
	'use strict';

    var _ajaxUrl = MK.core.path.ajaxUrl;
    var _instances = {};

	MK.utils.ajaxLoader = function ajaxLoader(el) {
		// retrun a cached instance to have control over state from within multiple places
		// we may need for example to reset pageId when do filtering. It is really one instance that controls both filtering and pagination / load more
		var id = '#' + ($(el).attr('id'));
		if(typeof _instances[id] !== 'undefined') return _instances[id];

		// else lets start new instance
		this.id = id;
		this.el = el;
		this.isLoading = false;
		this.xhrCounter = 0;
	};

	MK.utils.ajaxLoader.prototype = { 
		init: function init() {
			// prevent double initialization of we return an instance
			if(this.initialized) return;

			this.createInstance();
			this.cacheElements();

			this.initialized = true;
		},

		cacheElements: function cacheElements() {
			this.$container = $(this.el);
			this.id = '#' + (this.$container.attr('id'));
	        this.categories = this.$container.data('loop-categories');

			this.data = {};
			this.data.action = 'mk_load_more';
	        this.data.query = this.$container.data('query');
	        this.data.atts = this.$container.data('loop-atts');
	        this.data.loop_iterator = this.$container.data('loop-iterator');
	        this.data.author = this.$container.data('loop-author');
	        this.data.posts = this.$container.data('loop-posts');
	        this.data.safe_load_more = this.$container.siblings('#safe_load_more').val();
	        this.data._wp_http_referer = this.$container.siblings('input[name="_wp_http_referer"]').val();
	        this.data.paged = 1;
	        this.data.maxPages = this.$container.data('max-pages');
	        this.data.term = this.categories;
		},

		createInstance: function() {
			_instances[this.id] = this;
		},

		load: function load(unique) {
			var self = this;
			var seq = ++this.xhrCounter;
            this.isLoading = true;
			
			// If mk-ajax-loaded-posts span exists, get the post ids
			if ( this.$container.siblings('.mk-ajax-loaded-posts').length ) {
				var loaded_posts = this.$container.siblings('.mk-ajax-loaded-posts').attr('data-loop-loaded-posts');
				
				// Do not send looaded posts for Classic Pagination Navigation
				if ( this.$container.attr('data-pagination-style') != 1 ) {
					self.data.loaded_posts = loaded_posts.split(',');
				}
			}

            return $.when(
	            $.ajax({
	                url 	: _ajaxUrl,
	                type 	: "POST",
	                data 	: self.data
	            })
	        ).done(function(response) {
	        	self.onDone(response, unique, seq);
	        });
		},

		onDone: function(response, unique, seq) {
			if(seq === this.xhrCounter) {
				var self = this;

				response = $.parseJSON(response);
				response.unique = parseInt(unique, 10);
				response.id = this.id;
				
				// If mk-ajax-loaded-posts span exists, update current post ids 
				// with new post ids from server's response
				if ( this.$container.siblings('.mk-ajax-loaded-posts').length ) {
					this.$container.siblings('.mk-ajax-loaded-posts').attr('data-loop-loaded-posts', response.loaded_posts);
				}

	            this.setData({
	                maxPages: response.maxPages,
	                found_posts: response.found_posts,
	                loop_iterator: response.i
	            });

				// Preload images first by creating object from returned content.
				// mk_imagesLoaded() method will create a promise that gets resolved when all images inside are loaded.
				// Our ajaxLoad is somehow more similar to window.onload event now.
				$(response.content).mk_imagesLoaded().then(function() {
					MK.utils.eventManager.publish('ajaxLoaded', response);
		        	self.isLoading = false;
		        	self.initNewComponents();
				});

	        } else console.log('XHR request nr '+ seq +' aborted');

        },

		setData: function setData(atts) {
			for(var att in atts) {
				if(att === 'term' && atts[att] === '*') this.data.term = '';
				else this.data[att] = atts[att];
			}
		},

		getData: function getData(att) {
			return this.data[att];
		},

		initNewComponents: function initNewComponents() {
            // Legacy scripts reinit
            window.ajaxInit();
            setTimeout(window.ajaxDelayedInit, 1000);
            // New way to init apended things
            MK.core.initAll(this.el);
        }
	};

}(jQuery));
(function($) {
	'use strict';

	/**
	 *	Take all elements with data-mk-img-set attribute and evaluate best image according to given device orientation and resolution,
	 *	sets style for backround-image on the same node element.	 * 
	 */

	var $win = $(window),
		$layers = $('[data-mk-img-set]'),
		screen = getScreenSize(),
		orientation = getOrientation(),
		device = getDevice(),
		lastOrientation = orientation,
		lastDevice = device;

	// Run and bind
	run();
	$win.on('resize', MK.utils.throttle(500, handleResize));

	function run() {
		$layers.each(applyBg);
	}

	// Keep our main side effect out of calculations so they can be run once before loop of applying bg as a result
	function applyBg() {
		var $this = $(this), 
			imgs = $this.data('mk-img-set');

		$this.css('background-image', 'url('+ getImage(imgs) +')');
		$this.find('.mk-adaptive-image').attr('src', getImage(imgs)); 
	}

	// Keep track of current screen size while resizing but update device reference 
	// and reapply backgrounds only when we discover switch point
	function handleResize() { 
		updateScreenSize();
		if(hasSwitched()) {
			updateDevice();
			run();
		}
	}

	function getScreenSize() {
		return {
			w: $win.width(),
			h: $win.height() 
		};
	}

	// Name our device classes and add them id which simply means which one is wider
	function getDevice() {
		if     (screen.w > 1024) 	return {class: 'desktop', id: 2};
		else if(screen.w > 736) 	return {class: 'tablet',  id: 1};
		else 					 	return {class: 'mobile',  id: 0};
	}

	function getOrientation() {
		if(screen.w > screen.h) 	return 'landscape';
		else 						return 'portrait';
	}

	// As desired image might be not available we have to evaluate the best match.
	function getImage(imgs) {
		if (imgs['responsive'] === 'false') {
			return (imgs['landscape']['desktop']) ? imgs['landscape']['desktop'] : (imgs['landscape']['external'] ? imgs['landscape']['external'] : '');
			
		}
		var hasOrientation = !!imgs[orientation];
		// there are only two orientations now and we may get them by string name if both are there 
		// or by index of 0 if only one is available. Note Objects has no lexical order so we need to grab key name by its index.
		// Also we may have external file for each orientation which we don't scale internaly so we grab it as it is. If nothing found return an empty string 
		var imgOriented = imgs[ (hasOrientation ? orientation : Object.keys(imgs)[0]) ],
			imgExact    = (imgOriented[device.class]) ? imgOriented[device.class] : (imgOriented['external'] ? imgOriented['external'] : '');
		return imgExact; 
	}

	function updateScreenSize() {
		screen = getScreenSize();
	}

	function updateDevice() {
		if(lastOrientation !== orientation) orientation = lastOrientation;
		// Switch device only if going from smaller size to bigger. 
		// Bigger to smaller is perfectly handled by browsers and doesn't require change and reupload
		if(lastDevice.id > device.id) device = lastDevice;
	}

	function hasSwitched() {
		lastOrientation = getOrientation();
		lastDevice = getDevice();

		if(lastOrientation !== orientation || lastDevice.class !== device.class) return true;
		else return false;
	}

}(jQuery));
(function( $ ) {
	'use strict';

	var val = MK.val;

	MK.component.FullHeight = function( el ) {
		var $window = $( window ),
			$this = $( el ),
			config = $this.data( 'fullheight-config' ),
			container = document.getElementById( 'mk-theme-container' ),
			minH = (config && config.min) ? config.min : 0,
			winH = null,
			height = null,
			update_count = 0,
			testing = MK.utils.getUrlParameter('testing'),
			offset = null;

		// We need to provide height on the same specificity level for workaround to IE bug
		// connect.microsoft.com/IE/feedback/details/802625/min-height-and-flexbox-flex-direction-column-dont-work-together-in-ie-10-11-preview
		// stackoverflow.com/questions/19371626/flexbox-not-centering-vertically-in-ie
		if(MK.utils.browser.name === ('IE' || 'Edge')) $this.css( 'height', '1px' );

		var update = function() {

			if(update_count === 0) {
				winH = $window.height();
				// for correct calculate
				offset = $this.offset().top - 1;
				height = Math.max(minH, winH - val.offsetHeaderHeight( offset ));
				$this.css( 'min-height', height );
				if(testing !== undefined )
				update_count++;
			}

		};

		// TODO remove scroll listener by dynamic offset reader
		var init = function() {
			update();
			$window.on( 'resize', update );
			$window.on( 'scroll', update );
			window.addResizeListener( container, update );
		};

		return {
			init : init
		};
	};

})( jQuery );


(function( $ ) {
	'use strict';

	var core  = MK.core,
		utils = MK.utils,
		path  = MK.core.path;


	MK.ui.FullScreenGallery = function( element, settings ) {
		this.element = element;
		this.config = settings;

		this.isFullScreen = false;
	};


	// preload slick PLUGIN TO USE THIS
	MK.ui.FullScreenGallery.prototype = {
		dom : {
			fullScrBtn 		: '.slick-full-screen',
			exitFullScrBtn 	: '.slick-minimize',
			playBtn 		: '.slick-play',
			pauseBtn 		: '.slick-pause',
			shareBtn 		: '.slick-share',
			socialShare 	: '.slick-social-share',
		    wrapper 		: '.slick-slider-wrapper',
			slider 			: '.slick-slides',
			slides 			: '.slick-slide',
			dots 			: '.slick-dot',
			active 			: '.slick-active',
			hiddenClass 	: 'is-hidden',
			dataId 			: 'slick-index'
		},

		tpl: {
			dot  : '<div class="slick-dot"></div>',
			next : '<a href="javascript:;" class="slick-next"> <svg width="33px" height="65px"> <polyline fill="none" stroke="#FFFFFF" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="10" points=" 0.5,0.5 32.5,32.5 0.5,64.5"/> </svg> </a>',
			prev : '<a href="javascript:;" class="slick-prev"> <svg  width="33px" height="65px"> <polyline fill="none" stroke="#FFFFFF" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="10" points=" 32.5,64.5 0.5,32.5 32.5,0.5"/> </svg> </a>'
		},

		init : function() { 
			var self = this;

			// core.loadDependencies([ path.plugins + 'slick.js' ], function() {
				self.cacheElements();
				self.getViewportSizes();
				self.updateSizes( 'window' );
				self.create();
				// update cache with elements propagated by plugin
				self.updateCacheElements();
				self.createPagination();
				self.bindEvents();
			// });
		},

		create : function() {
			var self = this;

			this.slick = this.$gallery.slick({
		        dots: true,
		        arrows: true,
				infinite: true,
				speed: 300,
				slidesToShow: 1,
				centerMode: true,
				centerPadding: '0px',
				variableWidth: true,
				autoplay: false,
				autoplaySpeed: 3000,
        		useTransform: true,
                prevArrow: self.tpl.prev,
                nextArrow: self.tpl.next,
                customPaging: function(slider, i) {
                    return self.tpl.dot;
                },
			});
		},

		cacheElements : function() {
			this.$window = $( window );
			this.$gallery = $( this.element );

			this.$fullScrBtn = $( this.dom.fullScrBtn );
			this.$exitFullScrBtn = $( this.dom.exitFullScrBtn );
			this.$playBtn = $( this.dom.playBtn );
			this.$pauseBtn = $( this.dom.pauseBtn );
			this.$shareBtn = $( this.dom.shareBtn );
			this.$socialShare = $( this.dom.socialShare );

		    this.$wrapper = $( this.dom.wrapper );
			this.$slider = $( this.dom.slider );
			this.$slides = $( this.dom.slides );
			this.$imgs = this.$slides.find( 'img' );
			// store reference to initial images without slides appended by pugin
			// - needed for creating of pagination
			this.$originalImgs = this.$imgs;
		},

		updateCacheElements : function() {
			this.$slides = $( this.dom.slides );
			this.$imgs = this.$slides.find( 'img' );
			this.$dots = $( this.dom.dots );
		},

		bindEvents : function() {
			var self = this;
			this.$fullScrBtn.on( 'click', this.toFullScreen.bind( this ) );
			this.$exitFullScrBtn.on( 'click', this.exitFullScreen.bind( this ) );
			this.$playBtn.on( 'click', this.play.bind( this ) );
			this.$pauseBtn.on( 'click', this.pause.bind( this ) );
			this.$shareBtn.on( 'click', this.toggleShare.bind( this ) );
			this.$socialShare.on( 'click', 'a', this.socialShare.bind( this ) );
			this.$window.on( 'resize', this.onResize.bind( this ) );
			this.$window.on( 'keydown', function(e) {
				if(e.keyCode === 39) self.$gallery.slick('slickNext');
				if(e.keyCode === 37) self.$gallery.slick('slickPrev');
			});
			$( document ).on( 'fullscreenchange mozfullscreenchange webkitfullscreenchange msfullcreenchange', this.exitFullScreen.bind( this ) );
		},

		getViewportSizes : function() {
			this.screen = {
				w: screen.width,
				h: screen.height
			};
			this.window = {
				w: this.$window.width(),
				h: this.$window.height()
			};
		},

		updateSizes : function( viewport ) {
			this.$wrapper.width( this[ viewport ].w );
			this.$wrapper.height( '100%' );
			this.$imgs.height( '100%');
		},

		createPagination : function() {
			var self = this;
			this.$dots.each( function( i ) {
				var img = self.$originalImgs.eq( i ).attr( 'src' );

				$( this ).css({
					'background-image': 'url('+ img +')'
				});
			});	
		},

		play : function(e) {
			e.preventDefault();
			this.$playBtn.addClass( this.dom.hiddenClass );
			this.$pauseBtn.removeClass( this.dom.hiddenClass );
			$( this.element ).slick( 'slickPlay' );
		},

		pause : function(e) {
			e.preventDefault();
			this.$pauseBtn.addClass( this.dom.hiddenClass );
			this.$playBtn.removeClass( this.dom.hiddenClass );
			$( this.element ).slick( 'slickPause' );
		},

		toggleShare : function(e) {
			e.preventDefault();
			this.$socialShare.toggleClass( this.dom.hiddenClass );
		},

		getCurentId : function() {
			return this.$slides.filter( this.dom.active ).data( this.dom.dataId );
		},

		toFullScreen : function() {
			var self = this;

			this.$fullScrBtn.addClass( this.dom.hiddenClass );
			this.$exitFullScrBtn.removeClass( this.dom.hiddenClass );

			this.$slider.hide().fadeIn( 500 );
			utils.launchIntoFullscreen( document.documentElement );
			this.updateSizes( 'screen' );
			$( this.element ).slick( 'slickGoTo', this.getCurentId(), true );

			// Update state with delay so we avoid triggering exitFullScreen fn from 
			// fullscreenchange event
			setTimeout( function() {
				self.isFullScreen = true;
			}, 1000);					
		},

		exitFullScreen : function() {
			if( this.isFullScreen ) { 
				this.$exitFullScrBtn.addClass( this.dom.hiddenClass );
				this.$fullScrBtn.removeClass( this.dom.hiddenClass );

				utils.exitFullscreen();
				this.updateSizes( 'window' );
				$( this.element ).slick( 'slickGoTo', this.getCurentId(), true );

				this.isFullScreen = false;
			}

		},

		onResize : function() {
			this.getViewportSizes();
			this.updateSizes( this.isFullScreen ? 'screen' : 'window' );
			$( this.element ).slick( 'refresh' );  
			$( this.element ).slick( 'slickGoTo', this.getCurentId(), true );
			this.updateCacheElements();
			this.createPagination();
		},

		socialShare : function( e ) {
			e.preventDefault();
			var $this = $( e.currentTarget ),
				network = $this.data( 'network' ),
				id = this.config.id,
				url = this.config.url,
				title = this.$wrapper.find( '.slick-title' ).text(),
				name;
				var picture = this.$slides.filter( this.dom.active ).children().first().attr( 'src' );
			switch( network ) {
				case 'facebook': 
					url = 'https://www.facebook.com/sharer/sharer.php?picture=' + picture+'&u=' + url + '#id=' + id;
					name = 'Facebook Share';
					break;
				case 'twitter':
					url = 'http://twitter.com/intent/tweet?text=' + url + '#id=' + id;
					name = 'Twitter Share';
					break;
				case 'pinterest':
					url = 'http://pinterest.com/pin/create/bookmarklet/?media=' + picture + '&url=' + url + '&is_video=false&description=' + title;
					// other available link paranmeters: media, description
					name = 'Pinterest Share';
					break;

			}

       		window.open( url, name, "height=380 ,width=660, resizable=0, toolbar=0, menubar=0, status=0, location=0, scrollbars=0" );
		}
	};

})( jQuery );
(function($) {
    'use strict';

    MK.component.Grid = function( el ) {
    	var $container = $(el);
    	var config = $container.data( 'grid-config' );
        var isSlideshow = $container.closest('[data-mk-component="SwipeSlideshow"]').length;
        var miniGridConfig = {
            container: el,
            item: config.item + ':not(.is-hidden)',
            gutter: 0 
        };

        var init = function init(){
            // Flags for cancelling usage goes first :
            // Quit early if we discover that Grid is used inside SwipeSlideshow as it brings bug with crossoverriding positioning 
            // + grid is not really needed as we have single row all handled by slider.
            // It happens only in woocommerce carousel as of hardcoded Grid in loop-start.php
            if(isSlideshow) return; 
	        MK.core.loadDependencies([ MK.core.path.plugins + 'minigrid.js' ], create);
        };

        // Remove el hidden without adding proper class
        var prepareForGrid = function prepareForGrid() {
            var $item = $(this);
            var isHidden = ($item.css('display') === 'none');
            if(isHidden) $item.addClass('is-hidden');
            else $item.removeClass('is-hidden');
        };

        var create = function create() {
            var timer = null;

	        function draw() { 
                // Prevent plugin breaking when feeding it with hidden elements
                $container.find(config.item).each( prepareForGrid );
	            minigrid(miniGridConfig);
	        }

            function redraw() {
                if (timer) clearTimeout(timer);
                timer = setTimeout(draw, 100);
            }

            // init
	        draw(); 
            // If reinitializing drop existing event handler
            $(window).off('resize', redraw);
            $(window).on('resize', redraw);
            MK.utils.eventManager.subscribe('item-expanded', redraw);
            MK.utils.eventManager.subscribe('ajaxLoaded', redraw);
            MK.utils.eventManager.subscribe('staticFilter', redraw);
        };

        return {
         	init : init
        };
    };

})(jQuery);








/**
 * ICON FACTORY @ Maki
 * 
 * Javascript part that translates css styles into link to server side manufacturer.
 * By passing extra args we generate icons as needed on server and send them back with ajax and attch them to DOM here.
 *
 * This is temporary solution that helps us switching from font icons to singular svgs without too match overhead. The finalized solution shoulnd be 99% server side.
 * Our main templating is happening there. We should have an icon_factory(name, properties) function that we can call directly in templates to serve us icons. 
 * Post load, js soluition should target only elements that we have no direct access to. We set it as TODO for future as part of progressive development. 
 * When correct factory is done we should be able to use it here and there to progressively kill overhead generated by current solution until we could totally switch it.
 * 
 * Prons:
 * - automated process where we can mimic old behaviour
 * - possible bugs are easy to patch 
 * - far samller download size for assets needed by theme (no font families css and fonts itself to download, which are currently blocking page load time)
 * - icon generation moved to server side where our main templating is already happening
 * - we can easily switch how our Icon should be outputed - inline, img, object, iframe. Whatever our situation requires (img for responsive icons for example)
 *
 * Cons:
 * - possible bugs based on different nature of svgs / fonts. Need to be manually fixed
 * - some manual work to straighten things - litle css refactors here and there
 * - as the mapping the icons happens in server side, it may cause CPU bottlenecks and should be cashed in DB for repetitve usage.
 *
 *
 * TODO Refactor to config obj as parameter for easier passing it. Also decouple more - especially loops
 */
(function ($) {
	'use strict';

	// As long as we can manage this manually it is better like so. We avoid delay based on waiting for ajax to finish
 	// $.get( MK.core.path.theme + '/assets/icons/icon-families.json', createAll);
 	var families = [
		['awesome-icons' , 'mk-icon'], // [family, prefix]
		['icomoon' 		 , 'mk-moon'],
		['pe-line-icons' , 'mk-li'],
		['theme-icons' 	 , 'mk-jupiter-icon'] 
	];

	// Our css contains this extends for particular families of fonts. For now we automate the process and extend it here as well
	var extend = {
		'awesome-icons' : [
			'.mk-accordion-tab',
			'.mk-toggle-title',
			'.mk-blockquote.quote-style',
			'blockquote',
			'.mk-main-navigation ul',
			'.sf-sub-indicator',
			'.widget_archive li a',
			'.widget_categories li a',
			'.widget_nav_menu li a',
			'.widget_links li a',
			'.widget_pages li a',
			'.widget_meta li a',
			'.widget_authors li a',
			'.widget_popular_tags li a',
			'.widget_recent_comments li',
			'.widget_rss li a',
			'.widget_recent_entries li a',
			'.tw_list .tweet_list li a',
			'#wp-calendar #prev',
			'#wp-calendar #next',
			'.mk-jupiter-icon-simple-xing',
			'.widget_product_categories li a',
			'.widget-sub-navigation li a',
			'.main-navigation-ul li.with-menu > a',
			'.blog-blockquote-content',
			'.ls-nav-prev',
			'.ls-nav-next'
		], 

		'icomoon' : [
			'.mk-woocommerce-pagination .next',
			'.mk-woocommerce-pagination .prev',
			'.product-loading-icon',
			'.mk-jupiter-icon-xing',
			'.mk-jupiter-icon-square-xing'
		],

		'pe-line-icons' : [],
		'theme-icons' : []
	};	
 	
 	// Cache holder for quick access to repeating icons. config / svg
	var _cache = {};
	var _cacheId = 0;
	// Merge configs to call it with single ajax
	var _config = [];
	// Counter for all families. We merge all our families for single ajax request and countdown when to trigger the download.
	var _roundCount = 0;
	// Mapper for icons - config / array with nodes
	var _iconMap = {};


	// Closure to merge $icons together and to run the download when we counted down icon families to 0
 	var getIconsSprite = (function() {
 		var $icons = null;
 		var iterator = 0;

 		function run(callback) {
	 		var config = encodeURIComponent(JSON.stringify(_config));

			//$.ajax({
				//url : MK.core.path.ajaxUrl,
				// dataType: 'xml',
				//method: 'POST',
				//data: {action : 'mk_get_icon', iterator: iterator++, config: config},
				//success: function(sprite) { 
				//	callback(sprite, $icons);
				//	_config = [];
				//	_iconMap = {};
				//	$icons = null;
				//},
				//error: function(err) { 
				//	console.log('Icon load problem');
				//}
			//});
		}

		return function(callback, $els, count) {
			if(!$icons) $icons = $els;
			else $icons.add($els);
			// console.log(count);
			if(!count) run(callback);
		};
 	}());

 	// Wait for DOM manipulations and run where really needed
 	$(window).on('load', function() { 
 		setTimeout(function() {
 			createAll(document);
 			if($('.mk-header').length) createAll('.mk-header');
 			if($('.js-flexslider, .mk-flexslider').length) createAll('.js-flexslider, .mk-flexslider');
 			if($('.mk-accordion').length) createAll('.mk-accordion'); 
 		}, 1000); 
 	});

 	MK.utils.eventManager.subscribe('ajaxLoaded', function() {
 		// Wait for actuall DOM insertion
 		setTimeout(createAll, 100, '.js-loop');
 	});

	MK.utils.eventManager.subscribe('ajax-preview', function() {
 		setTimeout(createAll, 100, '.ajax-container');
	});

	MK.utils.eventManager.subscribe('photoAlbum-open', function() {
 		setTimeout(createAll, 100, '.gallery-share');
	});

	MK.utils.eventManager.subscribe('quickViewOpen', function() {
 		setTimeout(createAll, 300, '.mk-modal-content');
	});

 	// Our main runner that creates all icons in given scope
 	function createAll(scope) {
		// iterate through families
 		for(var i = 0, l = families.length; i < l; i++) {
 			var family = families[i][0];
 			var prefix = families[i][1];
 			var $icons = getIcons(family, prefix, scope);
 			if($icons.length) {
 				_roundCount++;
 				// apply arguments from current loop iteration but send createIcons to event loop so it will get trigerred in the same order as this loop finish.
 				// We need it to pass all $icons first so we can merge all families before ajax request.
 				setTimeout(createIcons, 0, $icons, family, prefix);
 			}
 		}
 	}

 	// Grab all els in given scope that contains our prefix, anywhere in class attribute. Extend if needed
 	function getIcons(family, prefix, scope) {
 		var $scope = $(scope);
 		var $icons = $scope.find('[class*='+ prefix +']');
 		var extraClassNames = extend[family];
 		// if nothing to extend just return what we have till now
 		if(!extraClassNames) return $icons; 
 		// Extend it with our css garbish
 		extraClassNames.forEach(function(className) {
 			var $icon = $scope.find(className);
 			$icons = $icons.add($icon);
 		});
 		// serve all
 		return $icons;
 	}


 	function createIcons($icons, family, prefix, i, unicode) {
 		var id   = i || 0;
		var icon = $icons[id];

		// quick check point, if no more icons break recursion
		if(!icon) {
			_roundCount--;
			getIconsSprite(insertIcons, $icons, _roundCount, _config);
			return;
		}

		var css       = getComputedStyle( icon, ':before');
		var classAttr = icon.getAttribute('class');
		var name      = (classAttr) ? matchClass(classAttr.split(' '), prefix) : false;
		var h         = getComputedStyle(icon).fontSize;
		var config    = createConfig(css, name, family, unicode, h);
		var cache 	  = JSON.stringify(config);

		if(!config) {
			// Yep, we have a mess so sometimes we try to call for an icon where it should not exist (no class match or unicode found)
			// As we expect empty response from server, we just skip to next icon

		} else if(_cache[cache]) {
			// Use cached icon when possible
			// 
			if(typeof _iconMap[cache] === 'undefined') _iconMap[cache] = [$icons.eq(id)];
			else _iconMap[cache].push($icons.eq(id));

		} else {
			if(typeof _iconMap[cache] === 'undefined') _iconMap[cache] = [$icons.eq(id)];
			else _iconMap[cache].push($icons.eq(id));

			_cache[cache] = _cacheId.toString(); // number as string so we could do [var] key lookup after reversal
			config.id = _cacheId; // extend config for server only
			_config.push(config);

			_cacheId++; // increment after caching
		}

		createIcons($icons, family, prefix, ++id);
 	}

 	function insertIcons(sprite, $icons) {
 		var $sprite = $(sprite);
 		var $svgs   = $sprite.find('svg');
 		var idMap   = invert(_cache);

 		$sprite.each(function() {
 			var $svg = $(this);
 			var id   = $svg.attr('data-cacheid'); // read as string
 			var configKey = idMap[id];

 			_cache[configKey] = this;
 			// console.log(id, this)
 		});

 		// console.log('sprite',sprite)
 		// 

 		Object.keys(_iconMap).forEach(function (cacheKey) {
		   	_iconMap[cacheKey].forEach(function($icons) {
		   		$icons.each(function() {
		   			var $svg = $(_cache[cacheKey]).clone();
		   			var $icon = $(this);

		   			// console.log($icon[0], _cache[cacheKey]);  
		   			
		   			function remove() {
		   				// exclude problematic stuff
		   				if($icon.parents('.pricing-features')) return;
			   			$icon.not('.mk-jupiter-icon-xing') 
			   				 .not('.mk-jupiter-icon-square-xing')
			   				 .not('.mk-jupiter-icon-simple-xing')
			   				 .find('.mk-svg-icon') 
			   				 .not('[data-name="mk-moon-zoom-in"]')
			   				 .remove(); // and remove else to reapply styles with new loaded svg
		   			}

		   			if($svg.length ) remove();

		   			if(!$icon.find('svg').length) {
		   				if($icon.parents('.widget ul').length) $icon.prepend($svg);
		   				else $icon.append($svg);
					}
		   		});
		   	});
		});

 		// Notify rest of app
		MK.utils.eventManager.publish('iconsInsert');
 	}

 	// Prepare configuration for server side. We need to grab icons and manipulate them a little there
 	function createConfig(css, name, family, unicode, height) {
 		var hasGradient  = checkGradient(css);
 		var hasDirection = extractGradient('direction', css.background);

 		var config = {
 			family: family, 
 			// this is mostly for Extends. Because we've been customizing singular elements and assigning content unicode manually, 
 			// now we don't have any proper anchor for usage with our json map
 			unicode: (unicode) ? unicode : decodeUnicode(css.content), 
 			name: name,
 			// fill: css.color,
 			gradient_type:  hasGradient ? extractGradient('type' , css.background) : false,
 			gradient_start: hasGradient ? extractGradient('start', css.background) : false,
 			gradient_stop:  hasGradient ? extractGradient('stop' , css.background) : false,
 			gradient_direction: hasDirection ? extractGradient('direction', css.background).replace(' ', '-') : false,
 			height: height
 		};

 		// If there is no name or unicode the whole config is invalid
 		if(!config.name && !config.unicode) return false;
 		else return config;
 	}

 	// Extract class name that represents the icon that we try to generate
 	function matchClass(classes, prefix) {
 		// var missing = '';
 		for(var i = 0, l = classes.length; i < l; i++) {
 			if(classes[i].indexOf(prefix) !== -1) return classes[i]; // return first matched class name
 			// else missing += ' .' + classes[i]; // collect not matching classes
 		}
 		// if we didn't returned anything within loop we output notification here. Keep it for testing only
 		// console.log('Possibility of missing icons for element with classes:' + missing);
 	}

 	// Check if background conatains gradient declaration and return bg string if so or false 
 	function checkGradient(css) {
 		var bg = css.background;
 		if(bg.indexOf('radial') !== -1 || bg.indexOf('linear') !== -1) return bg;
 		else return false;
 	}

 	// Extract background attribiutes from bg string.
 	// Multipurpose function which returns part we ask for
 	function extractGradient(attr, grad) {
 		// quit if gradient is falsy
 		// console.log(grad);
 		if(!grad) return false;

 		var isRadial = grad.indexOf('radial')  !== -1;
 		var isLinear = grad.indexOf('linear')  !== -1;
 		var hasDirection = grad.indexOf('(to') !== -1;
 		var f, t; // from, to

 		if(attr === 'type') {
 			if(isRadial) return 'radial';
 			if(isLinear) return 'linear';

 		} else if(attr === 'start') {
 			f = getStrPosition(grad, 'rgb(', 1);
 			t = getStrPosition(grad, '0%'  , 1);

 		} else if(attr === 'stop') {
 			f = getStrPosition(grad, 'rgb(', 2);
 			t = getStrPosition(grad, '100%', 1);

 		} else if(attr === 'direction') {
 			if(!hasDirection) return false;
 			f = getStrPosition(grad, '(to', 1) + 4;
 			t = getStrPosition(grad, ', rgb(', 1);

 		} else {
 			return false;
 		}
 		
 		return grad.slice(f, t);
 	}

 	// Helper for getting indexOf but with lookup for instance of the string
 	// str - string to search
 	// m - what we're looking for
 	// i - instance, starting at 1
 	function getStrPosition(str, m, i) {
	   return str.split(m, i).join(m).length;
	}

	// JS outputs unicode results rather than code representation. This helper function does the job
	function decodeUnicode(content) {
		// escape() kills \ escape signature and outputs it as %u
		// str replace to drop special chars
		// and we bring it all to lowercase to match filenames we keep on server
		if(content && content !== 'none') return escape(content).replace(/%22/g, '').replace('%u', '').toLowerCase();
		else return false; // just in case we haven't provided content to work with
	}

	function invert(obj) {
	  	var new_obj = {};
	  	for (var prop in obj) {
	    	if(obj.hasOwnProperty(prop)) {
	      		new_obj[obj[prop]] = prop;
	    	}
	  	}
	  	return new_obj;
	}

}(jQuery));
(function($, window){
    'use strict';

    var scrollY = MK.val.scroll; 
    var dynamicHeight = MK.val.dynamicHeight;

    var $window = $(window);
    var $containers = $('.js-loop');

    $containers.each( pagination );

    function pagination() {
        var unique = Date.now();
        var $container = $(this);
        var $superContainer = $container.parent(); // should contain clearing so it stretches with floating children
        var $loadBtn = $container.siblings('.js-loadmore-holder').find('.js-loadmore-button');
        var $loadScroll = $('.js-load-more-scroll');
        var style = $container.data('pagination-style');
        var maxPages = $container.data('max-pages');
        var id = '#' + ($container.attr('id'));
        var ajaxLoader = new MK.utils.ajaxLoader(id);
        var isLoadBtn = (style === 2);
        var isInfiniteScroll = (style === 3); // add flag for last container
        var scrollCheckPoint = null;
        var isHandlerBinded = false;

        ajaxLoader.init();

        init();

        function init() {
            MK.utils.eventManager.subscribe('ajaxLoaded', onLoad);
            bindHandlers();
            if( isInfiniteScroll ) scrollCheckPoint = spyScrollCheckPoint();
        }

        function bindHandlers() {
            if( isLoadBtn ) $loadBtn.on('click', handleClick);
            if( isInfiniteScroll ) $window.on('scroll', handleScroll); 
            isHandlerBinded = true;
        }

        function unbindHandlers() {
            if( isLoadBtn ) $loadBtn.off('click', handleClick);
            if( isInfiniteScroll ) $window.off('scroll', handleScroll);
            isHandlerBinded = false;
        }

        function handleClick(e) {
            e.preventDefault();
            if(!ajaxLoader.isLoading) loadMore();
        }

        function handleScroll() {
            if((scrollY() > scrollCheckPoint()) && !ajaxLoader.isLoading) loadMore();
        }

        function loadMore() {
            loadingIndicatorStart();
            var page = ajaxLoader.getData('paged');
            ajaxLoader.setData({paged: ++page});
            ajaxLoader.load(unique);
        }

        function onLoad(e, response) {
            if( typeof response !== 'undefined' && response.id === id) {
                // Checking found posts helps to fix all pagination styles 
                if( ajaxLoader.getData('found_posts') <= 0 && ajaxLoader.getData('paged') >= ajaxLoader.getData('maxPages')) loadingIndicatorHide();
                else loadingIndicatorShow();
                if(response.unique === unique) $container.append(response.content);
                loadingIndicatorStop();
            }
        }

        function loadingIndicatorStart() {
            if(isLoadBtn) $loadBtn.addClass('is-active');
            else if(isInfiniteScroll) MK.ui.loader.add('.js-load-more-scroll');

        }

        function loadingIndicatorStop() {
            if(isLoadBtn) $loadBtn.removeClass('is-active');
            else if(isInfiniteScroll) MK.ui.loader.remove('.js-load-more-scroll');
        }

        function loadingIndicatorShow() {
            if(isHandlerBinded) return;
            if(isLoadBtn) $loadBtn.show();
            else if(isInfiniteScroll) $loadScroll.show();
            bindHandlers();
        }

        function loadingIndicatorHide() {
            if(!isHandlerBinded) return;
            if(isLoadBtn) $loadBtn.hide();
            else if(isInfiniteScroll) $loadScroll.hide();
            unbindHandlers();
        }


        function spyScrollCheckPoint() {
            var containerO = 0;
            var containerH = dynamicHeight( $superContainer );
            var winH = dynamicHeight( window );
 
            var setVals = function() {
                containerO = $superContainer.offset().top;
            };

            setVals();
            $window.on('resize', function() { requestAnimationFrame(setVals); });

            return function() {
                return (containerH() + containerO) - (winH() * 2);
            };
        }
    }

})(jQuery, window);
(function($) {
	'use strict';

	// Check if it's inside hidden parent
	// Cannot be position: fixed
	function isHidden(el) {
	    return (el.offsetParent === null);
	}

	MK.component.Masonry = function(el) {
		var $window = $(window);
		var $container = $(el);
		var config = $container.data( 'masonry-config' );
		var $masonryItems = $container.find(config.item);
		var cols = config.cols || 8;
		var $filterItems = null; // assign only when apply filter
		var wall = null;
		
        var init = function init() {
        	MK.core.loadDependencies([ MK.core.path.plugins + 'freewall.js' ], onDepLoad);
        };

        var onDepLoad = function onDepLoad() {
        	masonry();

        	// Events
	        $window.on('resize', onResize);
            MK.utils.eventManager.subscribe('ajaxLoaded', onPostAddition);
			MK.utils.eventManager.subscribe('staticFilter', resize);
        };

	    var masonry = function masonry() {
	    	// Quit for hidden elements for now.
	    	if(isHidden(el)) return;

	    	var newCols;
	    	if(window.matchMedia( '(max-width:600px)' ).matches) newCols = 2;
	    	else if(window.matchMedia( '(max-width:850px)' ).matches) newCols = 4;
	    	else newCols = cols;

	    	var colW = $container.width() / newCols;

	        wall = new Freewall( config.container );

	        // We need to pass settings to a plugin via reset method. Strange but works fine.
			wall.reset({
				selector: config.item + ':not(.is-hidden)',
				gutterX: 0, // set default gutter to 0 and again - apply margins to item holders in css
				gutterY: 0,
				cellW: colW,
				cellH: colW
			});

	        wall.fillHoles();
	        wall.fitWidth();

	        $masonryItems.each(function() {
	        	$(this).data('loaded', true);
	        });
        };


		// Clear attributes after the plugin. It's API method dosn't handle it properly
		var destroyContainer = function destroyContainer() {
			$container.removeAttr('style')
				 .removeData('wall-height')
				 .removeData('wall-width')
				 .removeData('min-width')
				 .removeData('total-col')
				 .removeData('total-row')
				 .removeAttr('data-wall-height')
				 .removeAttr('data-wall-width')
				 .removeAttr('data-min-width')
				 .removeAttr('data-total-col')
				 .removeAttr('data-total-row');
		};

		var destroyItem = function destroyItem() {
			var $item = $(this);
			$item.removeAttr('style')
				 .removeData('delay')
				 .removeData('height')
				 .removeData('width')
				 .removeData('state')
				 .removeAttr('data-delay')
				 .removeAttr('data-height')
				 .removeAttr('data-width')
				 .removeAttr('data-state'); 
		};

		var destroyAll = function destroyAll() {
	    	if( !wall ) return;
    		wall.destroy(); // API destroy
    		destroyContainer();
    		$masonryItems.each( destroyItem ); // run our deeper destroy
		};

		var onResize = function onResize() {
			requestAnimationFrame(resize);
		};

        var refresh = function refresh() {
	    	if( !wall ) return; 
	    	setTimeout(wall.fitWidth.bind(wall), 5);
        };

        var resize = function resize() {
        	destroyAll();
	    	masonry();
        };

        var onPostAddition = function onPostAddition() {
        	$masonryItems = $container.find(config.item);

        	$masonryItems.each(function() {
        		var $item = $(this),
        			isLoaded = $item.data('loaded');

        		if(!isLoaded) $item.css('visibility', 'hidden');
        	});

        	
        	$container.mk_imagesLoaded().then(function() {
        		destroyAll();
        		masonry();
        	});
        };

        return {
         	init : init
        };
	};

}(jQuery));
(function($) {
	'use strict';

	MK.component.Pagination = function(el) {
		this.el = el;
	};

	MK.component.Pagination.prototype = {
		init: function init() {
			this.cacheElements(); 
			this.bindEvents();
		},

		cacheElements: function cacheElements() {
			this.lastId = 1;
			this.unique = Date.now();
			this.$pagination = $(this.el);
			this.$container = this.$pagination.prev('.js-loop');
			this.$pageLinks = this.$pagination.find('.js-pagination-page');
			this.$nextLink = this.$pagination.find('.js-pagination-next');
			this.$prevLink = this.$pagination.find('.js-pagination-prev');
			this.$current = this.$pagination.find('.js-current-page');
			this.$maxPages = this.$pagination.find('.pagination-max-pages'); // TODO change in DOM and here to js class
			this.containerId = '#' + this.$container.attr('id');
			this.ajaxLoader = new MK.utils.ajaxLoader('#' + this.$container.attr('id'));
			this.ajaxLoader.init();
		},

		bindEvents: function bindEvents() {
			this.$pageLinks.on('click', this.pageClick.bind(this));
			this.$nextLink.on('click', this.nextClick.bind(this));
			this.$prevLink.on('click', this.prevClick.bind(this)); 
			MK.utils.eventManager.subscribe('ajaxLoaded', this.onLoad.bind(this));
		},

		pageClick: function pageClick(e) {
			e.preventDefault(); 
			var $this = $(e.currentTarget);
			var id = parseFloat($this.attr('data-page-id'));

			if(id > this.ajaxLoader.getData('maxPages') || id < 1) return;
			this.load(id, $this);
		},

		nextClick: function nextClick(e) {
			e.preventDefault(); 
			if(this.ajaxLoader.getData('paged') === this.ajaxLoader.getData('maxPages')) return;
			this.load(++this.lastId, $(e.currentTarget));
		},

		prevClick: function prevClick(e) {
			e.preventDefault(); 
			if(this.ajaxLoader.getData('paged') === 1) return;
			this.load(--this.lastId, $(e.currentTarget));
		},

		load: function load(id, $el) {
			this.lastId = id;
			this.ajaxLoader.setData({paged: id});
			this.ajaxLoader.load(this.unique);
			this.removeIndicator();
			MK.ui.loader.add($el);
		},

		onLoad: function success(e, response) {
			if( typeof response !== 'undefined' && response.id === this.containerId) {
				this.updatePagination();
				this.lastId = this.ajaxLoader.getData('paged');

				if(response.unique === this.unique) {
					this.removeIndicator();
					this.scrollPage();
			        this.$container.html(response.content);  
				}   
			}         
        },

        updatePagination: function updatePagination() {
        	var self = this;

        	// Hide / show arrows
        	var isFirst = (this.ajaxLoader.getData('paged') === 1);
        	var isLast = (this.ajaxLoader.getData('paged') === this.ajaxLoader.getData('maxPages'));

        	if(isFirst) this.$prevLink.addClass('is-vis-hidden');
        	else this.$prevLink.removeClass('is-vis-hidden');

        	if(isLast) this.$nextLink.addClass('is-vis-hidden');
        	else this.$nextLink.removeClass('is-vis-hidden');

			// X of Y
			this.$current.html(this.ajaxLoader.getData('paged'));
			this.$maxPages.html(this.ajaxLoader.getData('maxPages'));

			// Move overfloating items
			var displayItems = 10;
			var centerAt = displayItems / 2;

			if(this.ajaxLoader.getData('maxPages') > displayItems) {
				this.$pageLinks.each(function(i) {

					var id = self.lastId - centerAt;
						id = Math.max(id, 1);
						id = Math.min(id, self.ajaxLoader.getData('maxPages') - displayItems + 1);
						id = id + i;

					$(this).html( id ).attr('data-page-id', id).show();

					if(i === 0 && id > 1) $(this).html('...');
					if(i === displayItems - 1 && id < self.ajaxLoader.getData('maxPages')) $(this).html('...');
				});
			} else {
				this.$pageLinks.each(function(i) {
					var $link = $(this);
					var id = i + 1;

					$link.html(id).attr('data-page-id', id);

					if( self.ajaxLoader.getData('maxPages') === 1) {
						self.$pageLinks.hide();
					} else {
						if(i > self.ajaxLoader.getData('maxPages') - 1) $link.hide();
						else $link.show();						
					}

				});
			}

        	// Highlight current only
			this.$pageLinks.filter('[data-page-id="' + this.ajaxLoader.getData('paged') + '"]' ).addClass('current-page')
				 .siblings().removeClass('current-page');

        },

        scrollPage: function scrollPage() {
            var containerOffset = this.$container.offset().top;
            var offset = containerOffset - MK.val.offsetHeaderHeight( containerOffset ) - 20; 
            MK.utils.scrollTo( offset ); 
        },

        removeIndicator: function removeIndicator() {
        	MK.ui.loader.remove('.js-pagination-page, .js-pagination-next, .js-pagination-prev');
        }
	};

}(jQuery));
(function( $ ) {
	'use strict';

	var val = MK.val,
		utils = MK.utils;

	MK.component.Parallax = function( el ) {
		var self = this,
			$this = $( el ),
        	obj = $this[0],
			$window = $( window ),
		    container = document.getElementById( 'mk-theme-container' ),
			config = $this.data( 'parallax-config' ),
			$holder = $( config.holder ),
			headerHeight = null,
			offset = null,
			elHeight = null,
			ticking = false,
			isMobile = null;


		var clientRect = null;

		var update = function() {
			// Clear styles to check for natural styles
			// then apply position and size
			obj.style.transform = null;
			obj.style.top = null;
			obj.style.bottom = null;

			isMobile = MK.utils.isMobile();

			if( isMobile ) {
        		$this.css( 'height', '' );
				return;
			}

			clientRect = $this[ 0 ].getBoundingClientRect();
			offset = clientRect.top;
			elHeight = clientRect.height;
			headerHeight = val.offsetHeaderHeight( offset );
			offset = offset - headerHeight + val.scroll(); 

			setPosition(); 
			setSize( ); 
		};


        var h = 0,
        	winH = 0,
        	proportion = 0,
        	height = 0;

        // Position and background attachement should me moved to CSS but we repair it high specificity here as styles are not reliable currently
        var setSize = function() {
        	$this.css( 'height', '' );
        	winH = $window.height() - headerHeight;
        	h = obj.getBoundingClientRect().height; 

        	if( config.speed <= 1 && config.speed > 0 ) {
        		if( offset === 0 ) {
	        		$this.css({
	        			backgroundAttachment: 'scroll',
	        			'will-change': 'transform'
	        		});
        		} else {
	        		$this.css({
						height : h + ( (winH - h) * config.speed ),
	        			backgroundAttachment: 'scroll',
	        			'will-change': 'transform' 
	        		}); 
	        	}

        	} else if ( config.speed > 1 && h <= winH ) {
        		$this.css({
        			// good for full heights - 2 because it's viewable by 2 screen heights
        			height: ( winH  +  ( ( winH * config.speed ) - winH ) * 2 ),  
        			top: -( ( winH * config.speed ) - winH ),
        			backgroundAttachment: 'scroll',
        			'will-change': 'transform'
        		}); 

        	} else if ( config.speed > 1 && h > winH ) {
        		proportion = h / winH;
        		height = ( winH  +  ( ( winH * config.speed ) - winH ) * (1 + proportion) );
 
        		$this.css({
        			height: height,
        			top: -( height - (winH * config.speed) ),
        			backgroundAttachment: 'scroll',
        			'will-change': 'transform'
        		}); 

        	} else if ( config.speed < 0 && h >= winH ) {
        		height = h * (1  - config.speed);
        		$this.css({
					height: height + (height - h),
        			top: h - height,
        			backgroundAttachment: 'scroll',
        			'will-change': 'transform'
        		});   

        	} else if ( config.speed < 0 && h < winH ) {
        		// candidate to change
        		var display = (winH + h) / winH;
        		height = h * -config.speed * display;
        		$this.css({
					height: h + (height * 2),
        			top: -height,
        			backgroundAttachment: 'scroll',
        			'will-change': 'transform'
        		});         		
        	}
        };


		var currentPoint = null,
			progressVal = null,
			startPoint = null,
			endPoint = null,
			$opacityLayer = config.opacity ? $this.find( config.opacity ) : null,
			scrollY = null;

		var setPosition = function() {
			startPoint = offset - winH;
			endPoint = offset + elHeight + winH - headerHeight;
			scrollY = val.scroll();

			if( scrollY < startPoint || scrollY > endPoint ) { 
				ticking = false;
				return; 
			}

			currentPoint = (( -offset + scrollY ) * config.speed);

            $this.css({
              	'-webkit-transform': 'translateY(' + currentPoint + 'px) translateZ(0)',
              	'-moz-transform': 'translateY(' + currentPoint + 'px) translateZ(0)',
              	'-ms-transform': 'translateY(' + currentPoint + 'px) translateZ(0)',
              	'-o-transform': 'translateY(' + currentPoint + 'px) translateZ(0)',
              	'transform': 'translateY(' + currentPoint + 'px) translateZ(0)'
            });  

			ticking = false;
		};

 
		var requestTick = function() {
			if( !ticking && !isMobile ) {
				ticking = true;
				window.requestAnimationFrame( setPosition );
			}
		};


		var init = function() { 
			// Disable scroll effects when smooth scroll is disabled
			if( !MK.utils.isSmoothScroll ) { return; }

			update();
			setTimeout(update, 100);
			$window.on( 'load', update );
			$window.on( 'resize', update );
	        window.addResizeListener( container, update );
	        
			$window.on( 'scroll', requestTick );
		};
		
 
		return {
			init : init
		};
	};

})( jQuery );
(function($) {
	'use strict';

	MK.component.Preloader = function(el) {
		this.el = el;
	};

	MK.component.Preloader.prototype = {
		init: function init() {
			this.cacheElements();
			this.bindEvents();
		},

		cacheElements: function cacheElements() {
			this.$preloader = $(this.el);
		},

		bindEvents: function bindEvents() {
			this.onLoad(); // all components inited on page load
		},

		onLoad: function onLoad() {
			setTimeout(this.hidePreloader.bind(this), 300);
		},

		hidePreloader: function hidePreloader() {
			this.$preloader.hide();
		}
	};

}(jQuery));

(function($) {
	'use strict';

	// Image added for proportional scaling
	MK.ui.loader = {
		tpl : function() {
			return '<div class="mk-loading-indicator">' + 
						'<div class="mk-loading-indicator__inner">' +
							'<div class="mk-loading-indicator__icon"></div>' +
							'<img style="height:100%; width:auto;" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7">' +
						'</div>' +
					'</div>';
		},

		add : function(item) {
			$(item).append(this.tpl);
		},

		remove : function(item) {
			if(item) $(item).find('.mk-loading-indicator').remove();
			else $('.mk-loading-indicator').remove();
		}
	};

}(jQuery));
(function( $ ) {
	// IE / Edge fix for fixed positioned elements
	// MS clip path doesnt redraw properly so we expirience similar bug like with background attachement fixed on Chrome
	if (MK.utils.browser.name === 'Edge' || MK.utils.browser.name === 'IE') {
	 	var val = 1;
	 	var $edgeClipper = $('.mk-slider-slide'); // edge slider
	 	var $sectionClipper = $('.clipper-true'); // edge slider
	 	var $bgLayer = $('.background-layer'); // page section

    	var onScroll = function onScroll() {
	    	val *= -1;
	    	if( $edgeClipper.length ) $edgeClipper.each( redraw );
	    	if( $sectionClipper.length ) $sectionClipper.each( redraw );
	    	if( $bgLayer.length ) $bgLayer.each( redraw );
    	};

	 	var redraw = function redraw() {
	    	$(this).css('margin-top', val / 100);
	    };

	    $(window).on("scroll", function () {	    	
	    	window.requestAnimationFrame(onScroll);
	    });
	 }
}(jQuery));
(function($) {
	'use strict';

	// get initial values. those will be changed when needed
	var $imgs = $('img[data-mk-image-src-set]');
	var viewportClass = getViewportClass();
	// set constant for retina screens
	var isRetina = window.devicePixelRatio >= 2;

	// Run and bind to events
	run($imgs);
	$(window).on('resize', handleResize);
    MK.utils.eventManager.subscribe('ajaxLoaded', handleAjax); // ajax loops
    MK.utils.eventManager.subscribe('ajax-preview', handleAjax); // ajax poretfolio
    MK.utils.eventManager.subscribe('quickViewOpen', handleAjax); 

	function run($imgs) {
		if(!$imgs.length) return; // Do not run if empty collection
		$imgs.each(setSrcAttr);		
	}

	function setSrcAttr() {
		var $img = $(this);
		var set = $img.data('mk-image-src-set');
		// Set src attribute to img link suitable for our logic. It will load the image.
		if(set['responsive'] === 'false' && isRetina && set['2x']) $img.attr('src', set['2x']);
		else if(set['responsive'] === 'false') $img.attr('src', set.default);
		else if(viewportClass === 1 && isRetina && set['2x']) $img.attr('src', set['2x']); // default x2 for retina
		else if(viewportClass === 0 && set.mobile) $img.attr('src', set.mobile);
		else $img.attr('src', set.default);
	}

	function getViewportClass() {
		if(window.matchMedia('(max-width: 736px)').matches) return 0;
		else return 1; 
	}

	function handleResize() {
		if(!$imgs.length) return; // Do not run if empty collection
		var currentViewportClass = getViewportClass();
		// We don't need to reload bigger images when screen size is decreasing as browser already performs resize operation.
		// Run update on for increasing screen size
		if( currentViewportClass > viewportClass) {
			viewportClass = currentViewportClass; // update for further reference
			run($imgs);
		}
	}

	function handleAjax() {
    	setTimeout(function ajaxDelayedCallback() { // give it a chance to insert content first
	    	var $newImgs = $('img[data-mk-image-src-set]').not($imgs); // grab all images and exclude initially loaded
	    	$imgs.add($newImgs); // extend global reference for whatever operation expecting all available imgs
	    	run($newImgs); // run on new images only
    	}, 100);
    }

}(jQuery));
(function( $ ) {
	'use strict';

	var utils = MK.utils;
	var val   = MK.val;

	/**
	 * Keep track of top Level sections so we can easly skip to next one.
	 * We must be explicit about DOM level to nested sections.
	 * The list of sections is static. If you'd need to refreh it on ajax etc do it with pub/sub (not really needed now).
	 * We keep track for the same sections in Footer for mutating window location with '!loading' to prevent native anchor behaviour.
	 */
	var $topLevelSections = $('#theme-page > .vc_row, #theme-page > .mk-main-wrapper-holder, #theme-page > .mk-page-section');

	$( document ).on( 'click', '.mk-skip-to-next', function() {
		var $this = $( this ),
			offset = $this.offset().top ,
			nextOffset = utils.nextHigherVal( offset, utils.offsets( $topLevelSections ) );

		utils.scrollTo( nextOffset - val.offsetHeaderHeight( nextOffset ) ); 
	});

})( jQuery );
(function($) {
	'use strict';

	// 
	// Constructor
	// 
	// /////////////////////////////////////////////////////////

	MK.ui.Slider = function( container, config ) { 

		var defaults = {
				slide 				: '.mk-slider-slide',
	            nav 	     		: '.mk-slider-nav',
                effect              : 'roulete',
                ease 				: 'easeOutQuart', // should not be changed, remove
                slidesPerView       : 1,
                slidesToView        : 1,
                transitionTime      : 700,
                displayTime         : 3000,
                autoplay            : true,
                hasNav              : true,
                hasPagination       : true,
                paginationTpl 		: '<span></span>',
                paginationEl 		: '#pagination',
                draggable           : true,
                fluidHeight 		: false,
                pauseOnHover		: false,
                activeClass 		: 'is-active',
                onInitialize 		: function() {},
                onAfterSlide 		: function( id ) {},
                onBeforeSlide 		: function( id ) {}
		};

		this.state = {
			id 						: 0,
			moveForward 			: true,
			running   				: false,
            zIFlow					: null,
            stop 					: false,
		};

		this.config = $.extend( defaults, config );
		this.container = container;

		this.initPerView = this.config.slidesPerView;

		// Timer holder
		this.activeTimer = null;
		this.autoplay = null;
		this.timer = null;
		this.timerRemaining = parseInt(this.config.displayTime);
	};

	

	// 
	// Shared methods
	// 
	// /////////////////////////////////////////////////////////

	MK.ui.Slider.prototype = {

		init : function() {
			this.setPerViewItems();
			this.cacheElements();
			this.getSlideSize();
			this.bindEvents();
            this.setSize();
			this.setPos();

			// Hack for preparing 'prev' on first click if needed
			this.updateId( -1 );
			this.updateId( 1 );

			this.val = this.dynamicVal();
			this.timeline = this.prepareTimeline( this.config.transitionTime );

			this.timeline.build();

			if( this.config.hasPagination ) { this.buildPagination(); }
			
			if( this.config.autoplay && document.hasFocus() ) { this.setTimer(); }

			if( typeof this.config.onInitialize === 'function' ) {
				this.config.onInitialize( this.slides );
			}

			if( this.config.fluidHeight === true ) {
				$( this.slides ).height( 'auto' );
				$( this.container ).css( 'transition', 'height ' + 200 + 'ms ease-out' );
				this.setHeight( 0 );
			}


			if( this.config.fluidHeight === 'toHighest' ) {
				this.setHeightToHighest();
			}

			// Create timer per slide if required
			$(this.slides).each(this.createTimer);
		},


		cacheElements : function () {
			this.container = this.isNode( this.container ) ? this.container 
				: document.querySelectorAll( this.container )[0];
			this.slides = this.container.querySelectorAll( this.config.slide );
			this.$slides = $(this.slides);

			if( this.config.hasNav ) { this.$nav = $( this.config.nav ); }
			if( this.config.hasPagination ) { this.$pagination = $( this.config.paginationEl ); }
		},


		bindEvents : function() {
			var $window = $( window );

			if( this.config.slidesPerView > 1 ) { $window.on( 'resize', this.setPerViewItems.bind( this ) ); }
			if( this.config.hasNav ) { this.eventsNav(); }
			if( this.config.hasPagination ) { this.eventsPag(); }
			if( this.config.draggable ) { this.dragHandler(); }
			if( this.config.autoplay ) {
				$window.on( 'focus', this.windowActive.bind( this ) );
				$window.on( 'blur', this.windowInactive.bind( this ) );
			}
			if( this.config.pauseOnHover ) {
				$(this.container).on( 'mouseleave', this.setTimer.bind( this ) );
				$(this.container).on( 'mouseenter', this.unsetTimer.bind( this ) );
			}
			if( this.config.fluidHeight === 'toHighest' ) {
				$window.on( 'resize', this.setHeightToHighest.bind( this ) );
			}
		},


		setPerViewItems: function() {
			if(window.matchMedia( '(max-width: 500px)' ).matches) { this.config.slidesPerView = 1; }
			else if(window.matchMedia( '(max-width: 767px)' ).matches && this.initPerView >= 2 ) { this.config.slidesPerView = 2; }
			else if(window.matchMedia( '(max-width: 1024px)' ).matches && this.initPerView >= 3 ) { this.config.slidesPerView = 3; }
			else { this.config.slidesPerView = this.initPerView; }
			
        	if( typeof this.slides === 'undefined' ) return; 
			this.getSlideSize();
			this.setSize();
			this.setPos();
			this.timeline = this.prepareTimeline( this.config.transitionTime );
			this.timeline.build();
		},


		eventsNav : function() {
			this.$nav.on( 'click', 'a', this.handleNav.bind( this ) );
		},


		eventsPag : function() {
			this.$pagination.on( 'click', 'a', this.handlePagination.bind( this ) );
		},


		handleNav : function( e ) {
			e.preventDefault();

			if( this.state.running ) { return; }
			this.state.running = true;

			var $this = $( e.currentTarget ),
				moveForward = $this.data( 'direction' ) === 'next';


			if( this.config.autoplay ) { 
				this.unsetTimer();
				setTimeout( this.setTimer.bind( this ), this.config.transitionTime );
			}

			this.state.moveForward = moveForward;
			this.timeline.build();
			this.timeline.play();

			this.setActive( this.nextId( moveForward ? 1 : -1 ) );
			if( this.config.fluidHeight ) { this.setHeight( this.nextId( moveForward ? 1 : -1 ) ); }
		},


		handlePagination : function( e ) {
			e.preventDefault();

			var $this = $( e.currentTarget ),
				id = $this.index();

			this.goTo( id );
		},


		reset: function() {
			this.state.stop = true;
			this.state.id = 0;
			this.setPos();
			this.unsetTimer();
			this.setTimer();
		},


		goTo : function(id) {
			if( this.state.running ) { return; }
			this.state.running = true;

			var lastId = this.state.id;

			if( lastId === id ) {
				return;
			} else if( lastId < id ) {
				this.state.moveForward = true;
			} else {
				this.state.moveForward = false;
			}

			if( this.config.autoplay ) { 
				this.unsetTimer();
				setTimeout( this.setTimer.bind( this ), this.config.transitionTime );
			}

			this.timeline.build( Math.abs( lastId - id ) );
			this.timeline.play();

			this.setActive( id );
			if( this.config.fluidHeight ) { this.setHeight( id ); } 
		},


		windowActive : function() {
			this.setTimer(false, true);
			$(this.container).removeClass('is-paused'); 
		},


		windowInactive : function() {
			this.unsetTimer();
			$(this.container).addClass('is-paused');
		},


		updateId : function( val ) {
			this.state.id = this.nextId(val);
		},

		nextId : function( val ) {
			var len = this.slides.length,
				insertVal = this.state.id + val;
				insertVal = ( insertVal >= 0 ) ? insertVal : len + val;
				insertVal = ( insertVal >= len ) ? 0 : insertVal;

			return insertVal;
		},


		setStyle : function( obj, style ) {
            var hasT = style.transform,
            	t = {
	                x       : ( hasT ) ? style.transform.translateX : null,
	                y       : ( hasT ) ? style.transform.translateY : null,
	                scale   : ( hasT ) ? style.transform.scale 		: null,
	                rotate  : ( hasT ) ? style.transform.rotate 	: null,
	                rotateX : ( hasT ) ? style.transform.rotateX 	: null,
	                rotateY : ( hasT ) ? style.transform.rotateY 	: null
           		},
				z  = 'translateZ(0)',
            	x  = (t.x) ?  'translateX(' + t.x + '%)' 		: 'translateX(0)',
                y  = (t.y) ?  'translateY(' + t.y + '%)' 		: 'translateY(0)',
                s  = (t.scale)  ?  'scale(' + t.scale + ')' 	: 'scale(1)',
                r  = (t.rotate) ? 'rotate(' + t.rotate + 'deg)' : 'rotate(0)',
                rX = (t.rotateX) ? 'rotateX(' + t.rotateX + 'deg)' : '',
                rY = (t.rotateY) ? 'rotateY(' + t.rotateY + 'deg)' : '',

           		o = style.opacity,
           		h = style.height,
           		w = style.width;

            var c = z + x + y  + s + r + rX + rY;

            if( c.length ) {
	            obj.style.webkitTransform 	= c;
	            obj.style.msTransform 		= c;
	            obj.style.transform 		= c;
	        }

            if( typeof o === 'number' ) { obj.style.opacity = o; }
            if( h ) { obj.style.height  = h + '%'; }
            if( w ) { obj.style.width   = w + '%'; }
		},


		setPos : function() {
        	if( typeof this.slides === 'undefined' ) return; 
		    var id 			= this.state.id,
		    	i 			= 0,
		    	len 		= this.slides.length,
		    	animation 	= this.animation[ this.config.effect ],
		    	axis 		= animation.axis,
				animNext	= animation.next,
				animActi 	= animation.active,
				animPrev 	= animation.prev,
                perView 	= this.config.slidesPerView,
                slideId 	= null,
                zIFlow 		= null,
                style 		= {};

            style.transform = {};


            for( ; i < len; i += 1 ) {
                if(i < perView) {
                	// Position for visible slides. Apply active styles
                	style = animActi;
                    style.transform[ 'translate' + axis ] = i * 100;
                } else {
                	// Rest slides move after edge based on axis and moveForward. Apply Next / Prev styles
                	style = this.state.moveForward ? animNext : animPrev;
                    style.transform[ 'translate' + axis ] =  this.state.moveForward ? perView * 100 : -100;
                }

                this.slides[ i ].style.zIndex = 0;

                slideId = ( i + id ) % len;
                this.setStyle( this.slides[ slideId ], style );
            }
		},


        // When we're setting animation along Y axis we're going to set up height
        // otherwise width. It is shared amongst all slides
        setSize : function() {
        	if( typeof this.slides === 'undefined' ) return; 
        	var i = 0,
		    	len = this.slides.length,
		    	axis = this.animation[ this.config.effect ].axis,
                slideSize = this.slideSize,
        		style = {};

            if( axis === 'Y' ) {
                style.height = slideSize[ axis ];
            } else {
                style.width = slideSize[ axis ];
            }

            for( ; i < len; i += 1 ) {
                this.setStyle( this.slides[ i ], style );
            }
        },


        setHeight : function( id ) {
			var $slides = $( this.slides ),
				$activeSlide = $slides.eq( id );

        	var currentHeight = $activeSlide.height();
        	$( this.container ).height( currentHeight ); 
        },


        setHeightToHighest : function() {
        	// this is becouse of alliginig woocommrece carousel. Too much DOM
        	// Refactor someday
			var $slides = $( this.slides ),
				height = 0;

        	$slides.each(function() {
        		height = Math.max(height, $(this).find('> div').outerHeight());
        	});

        	$( this.container ).height( height ); 
        },


        // Little utility inspired by GreenSock.
        // We export this to this.timeline on init. 
        prepareTimeline : function( time ) {
			var self 		= this,
				iteration 	= 0,
            	totalIter 	= time / (1000 / 60),
            	animLoop 	= [],
            	aL 			= 0, // animation length
            	loops 		= 1,
				ease 		= this.config.ease, 
				currentStyle, timeProg, 
				build, move, add, play, reverse, progress, kill;


			// Build constants, run them only once
			// take out possibly
			var len 		= this.slides.length,
				perView   	= this.config.slidesPerView,
				animation 	= this.animation[ this.config.effect ],
				animAxis 	= animation.axis,
				animNext	= animation.next,
				animActi 	= animation.active,
				animPrev 	= animation.prev,
				style 		= {},
				slideId 	= null,
				zIFlow 		= null;

				style.transform = {};


			build = function( repeats ) {
				var currentEase = ease;
				loops = repeats || loops;

				// console.log('build', loops);

				if( !loops ) { return; }
				if( loops > 1 ) {
					currentEase = 'linearEase';
				}

				// clean before running new build
				kill();
				// set new positions
				self.setPos();

				var id = self.state.id,
					moveForward = self.state.moveForward,
					i = 0,
					axisMove = (moveForward) ? -100 : 100;

				for( ; i <= perView; i += 1 ) {
					slideId = ( (moveForward) ? i + id : i + id - 1 ) % len;
					slideId = ( slideId < 0 ) ? len + slideId : slideId;

					if( i === 0 ) {
						style = moveForward ? animPrev : animActi;
					} else if( i === perView ) {
						style = moveForward ? animActi : animNext;
					} else {
						style = animActi;
	            	}

               	 	zIFlow = (self.state.moveForward) ? animNext.zIndex : animPrev.zIndex; 
	                if( zIFlow ) { 
	                	// console.log( zIFlow );
	                	self.slides[ slideId ].style.zIndex = (zIFlow === '+') ? i + 1 : len - i;
	                }

					style.transform[ 'translate' + animAxis ] = axisMove;
	            	add( self.slides[ slideId ], style, currentEase );
				}
			};

			add = function( slide, toStyles, ease ) {
				if( typeof slide === 'undefined' ) {
					throw 'Add at least one slide';
				}

	            var fromStyles = slide.style,
					style = self.refStyle( toStyles, fromStyles );

				animLoop.push( [slide, style, ease] );
				aL += 1;
			};

			move = function( startProg, mode ) {
				if (isTest) return;
				var currentTotalIter = totalIter;

				if( loops > 1 ) {
				 	currentTotalIter = totalIter / 5;
				}

				if( !self.state.running ) { self.state.running = true; }

				if( startProg ) {
					// update iteration val to cached outside var
					// ceil to handle properly play after mouse up / touch end
					iteration = Math.ceil(startProg * currentTotalIter);
				}
				
				timeProg = iteration / currentTotalIter;
				progress( timeProg );

				// Break loop
				if( iteration >= currentTotalIter && mode === 'play' || 
					iteration <= 0 && mode === 'reverse' ) { 

					self.state.running = false;
					iteration = 0;
					kill();
	            	self.updateId( self.state.moveForward ? 1 : -1 );
					// If we're creating multiple animation loop we trigger outside only first pass to start all game.
					// the rest are triggered as callback
					loops -= 1;
					if( loops > 0 ) {
						build();
						play();
					}

					// if we run all loops reset back the default value
					if( !loops ) {
						loops = 1;
						self.timerRemaining = parseInt(self.config.displayTime);
						self.config.onAfterSlide( self.state.id );
					}

					return; 
				}

				// Run in given mode
				if( mode === 'play') {
					iteration += 1;
				} else {
					iteration -= 1;
				}

				requestAnimationFrame( function() {
					if(self.state.stop) return;
					move( 0, mode );
				});
			};

			play = function( startProg ) {
				self.config.onBeforeSlide( self.nextId(self.state.moveForward ? 1 : -1) );
				var start = startProg || 0;
				iteration = 0;
				self.state.stop = false;
				move( start, 'play' );
			};

			reverse = function( startProg ) {
				var start = startProg || 1;
				move( start, 'reverse' );
			};

			progress = function( progVal ) {
            	var aI = 0, 
            		currentStyle;

				for( aI; aI < aL; aI++ ) {
					if( progVal !== 1 && progVal !== 0 ) {
						currentStyle = self.currentStyle( progVal, animLoop[ aI ][ 1 ], animLoop[ aI ][ 2 ] );
					} else if( progVal === 1) {
						currentStyle = self.currentStyle( progVal, animLoop[ aI ][ 1 ], 'linearEase' );
					} else if ( progVal === 0 ) {
						currentStyle = self.currentStyle( progVal, animLoop[ aI ][ 1 ], 'linearEase' );
					} 
					self.setStyle( animLoop[ aI ][ 0 ], currentStyle );
				}
			};

			// Clear previous loop
			kill = function() {
				animLoop = [];
            	aL = 0;
			};


			return {
				build 		: build,
				add 		: add,
				play 		: play,
				reverse 	: reverse,
				progress 	: progress
			};
		},


		// Build reference styles.
		// Return object with array containig initial style and change of its value
		// as required for easing functions
		refStyle : function( toStyles, fromStyles ) {
			var axis = this.animation[ this.config.effect ].axis,
            	style = {},
				initVal, changeVal, endVal, dynamicEnd, styleProp, transProp, transform;

			for( styleProp in toStyles ) {

				if( styleProp === 'transform' ) {
					transform = this.getTransforms( fromStyles );
					style.transform = {};

					for( transProp in toStyles.transform ) {
						// don't care about z
						if( transProp === 'translateZ' ) { continue; }

						initVal = transform[ transProp ] || 0; // if it is undefined it means it's 0
						dynamicEnd = ( transProp === 'translate' + axis ) ? initVal : 0;
						endVal  = toStyles.transform[ transProp ] + dynamicEnd; // it is dynamic, based on slide position in current set
						changeVal = endVal - initVal;
						style.transform[ transProp ] = [ initVal, changeVal ];
					}
				} else if( styleProp === 'zIndex' ) {
					// console.log( 'z' );
					continue;
				} else {
					initVal = parseFloat( fromStyles[ styleProp ] ) || 0; // if it is undefined it means it's 0
					endVal  = toStyles[ styleProp ];
					changeVal = endVal - initVal;
					style[ styleProp ] =  [ initVal, changeVal ];
				}
			}

			return style;
		},


		currentStyle : function( progress, style, ease ) {
			var self = this,
				currentStyle = {},
            	currentVals, styleProp, transProp, prog;

			// Redo same loop but construct currentStyle object out of cached values
			for( styleProp in style ) {

				if( styleProp === 'transform' ) {
					currentStyle.transform = {};

					for( transProp in style.transform ) {
						// remove this line. double check first if needed by logging
						if( transProp === 'translateZ' ) { continue; }

						currentVals = style.transform[ transProp ];
						currentStyle.transform[ transProp ] = 
							// (currentIteration, startValue, changeInValue, totalIterations)
								self.ease[ ease ]( progress, currentVals[ 0 ], currentVals[ 1 ], 1 );
					}
				} else {
					currentVals = style[ styleProp ];
					currentStyle[ styleProp ] = 
						self.ease[ ease ]( progress, currentVals[ 0 ], currentVals[ 1 ], 1 );
				}
			}

			return currentStyle;
		},


		setActive : function( id ) {
			var $slides = $( this.slides ),
				className = this.config.activeClass;

			$slides.removeClass( className );

			if( this.config.hasPagination ) {
				var $pagination = this.$pagination.find( 'a' );
				$pagination.removeClass( className );
				$pagination.eq( id ).addClass( className );
			}

			if( this.activeTimer ) {
				// console.log( 'clearActive' );
				clearTimeout( this.activeTimer );
			} 

			this.activeTimer = setTimeout( function() {
				// console.log('setActive');
				$slides.eq( id ).addClass( className );
			}, this.config.transitionTime );
		},

		createTimer : function() {
			var $slide = $(this),
				video = $slide.find('video').get(0);

			if(video) {
				$slide.data('timer', (video.duration * 1000));
				$slide.attr('data-timer', (video.duration * 1000));
			}
		},
		
		setTimer : function( isFirst, isPaused ) {
			// check for custom timer
			var customTimer = this.$slides.eq(this.nextId(this.state.moveForward ? 1 : -1)).data('timer'),
				trans = parseInt( this.config.transitionTime ),
				interval = customTimer ? customTimer : parseInt( this.config.displayTime ),
				timer = interval + trans;

			var self  = this,
				first = isFirst || true,
				create, run;

			this.timer = true;
			this.lastSetTimer = Date.now();

			create = function() {	

				if( self.autoplay ) { clearTimeout( self.autoplay ); }
				if( !self.timer ) {
					return;
				}
				self.state.moveForward = true;
				self.timeline.build();
				self.timeline.play();
				self.setActive( self.nextId( 1 ) );
				if( self.config.fluidHeight ) { self.setHeight( self.nextId( 1 ) ); }
				first = false;
				self.lastSetTimer = Date.now();

				run();
			};

			run = function(newInterval) {
				// check for custom timer
				customTimer = self.$slides.eq(self.nextId(self.state.moveForward ? 1 : -1)).data('timer');
				interval = customTimer ? customTimer : parseInt( self.config.displayTime );
				timer = interval + trans; // update timer with current val

				var time = newInterval || timer;
				self.autoplay = setTimeout( create, time );
			};

			if(isPaused) {
				run(this.timerRemaining);
			}
			else run();
		},


		unsetTimer : function() {
			this.timer = false;
			this.lastUnsetTimer = Date.now();
			this.timerRemaining -= this.lastUnsetTimer - this.lastSetTimer;
			if( this.autoplay ) { clearTimeout( this.autoplay ); }
		},


		buildPagination : function() {
			var i   = 0,
				len = this.slides.length,
				tpl = '';

			for( ; i < len; i += 1 ) {
				tpl += '<a href="javascript:;">' + this.config.paginationTpl + '</a>';
			}

			this.$pagination.html( tpl );
			this.setActive( 0 );
		},


		getSlideSize : function() {
			this.slideSize = {
                X: 100 / this.config.slidesPerView,
                Y: 100 / this.config.slidesPerView
            };
		},


		getTransforms : function( style ) {
			// console.log( style );
		    var transform = style.transform || style.webkitTransform || style.mozTransform,
		    	regex = /(\w+)\(([^)]*)\)/g,
				match,
				T = {};

			if( typeof transform !== 'string' ) {
				throw 'Transform prop is not a string.';
			}

		    if( !transform ) { return; }
	
			// Run regex assignment
			while( match = regex.exec( transform ) ) {
				T[ match[ 1 ] ] = parseFloat( match[ 2 ] );
			}

		    return T;
		},

		isNode : function( o ) {
			return (
		    	typeof Node === "object" ? o instanceof Node : 
		   			o && typeof o === "object" && typeof o.nodeType === "number" && typeof o.nodeName==="string"
		  	);
		},


		dragHandler : function() {
			var self = this,
				$container = $( this.container ),
				prevBuild = false, 
				nextBuild = false,
				dragging = false,
				buffor = 5, // helpful for decoupling with click events
				dragStart, dragMove, dragEnd, progress;

			progress = function( moveX ) {
				return moveX / self.val.viewportW();
			};

			dragStart = function( moveX, startX ) {
				// console.log( 'start', moveX, startX );
			};

			dragMove = function( moveX ) {
				// console.log('move');
				if( self.state.running ) return;

				// Don't need to check for existance here

				if( moveX < -buffor ) {

					if( !nextBuild ) {
						self.state.moveForward = true;
						self.timeline.build();
						nextBuild = true;
						prevBuild = false;
						self.unsetTimer();
					} else {
						// turn progress into positive val
						self.timeline.progress( -progress( moveX ) );
					}
					dragging = true;
				} else if( moveX > buffor ) {

					if( !prevBuild ) {
						self.state.moveForward = false;
						self.timeline.build();
						prevBuild = true;
						nextBuild = false;
						self.unsetTimer();
					} else {
						self.timeline.progress( progress( moveX ) );
					}
					dragging = true;
				}
			};

			dragEnd = function( moveX ) {
				if( dragging ) {
					var prog = progress( moveX ),
						absProg = prog < 0 ? -prog : prog;

					if( absProg > 0.1 ) {
						self.timeline.play( absProg );
						self.setActive( self.nextId( prog < 0 ? 1 : -1 ) );
						if( self.config.fluidHeight ) { self.setHeight( self.nextId( prog < 0 ? 1 : -1 ) ); }
					} else {
						self.timeline.reverse( absProg );
						// eventually move this to reverse callbacks	
						if(prog < 0) {
							self.updateId( -1 );
						} else {
							self.updateId( 1 );
						}
					}

					prevBuild = false;
					nextBuild = false;
					dragging = false;
					if( self.config.autoplay ) { self.setTimer( false ); }
				}
			};

			this.drag( $container, dragStart, dragMove, dragEnd );
		},


		drag : function( $el, startFn, moveFn, stopFn ) {

		    var touchX, touchY, movX, movY, go, evt,
		   		prevent, start, move, stop;

		    prevent = function( e ) {
		        e.preventDefault();
		    };

		    start = function( e ) {
		        // $el.on("touchmove", prevent);
		        $el.on("mousemove", prevent);
		        $el.on("touchmove", move);
		        $el.on("mousemove", move);

		        evt = (e.type === 'touchstart') ? e.originalEvent.touches[0] : e;
		        touchX = evt.pageX;

		        if(typeof startFn === 'function') {
		        	startFn(movX, touchX);
		        }
		    };

		    move = function( e ) {
		        evt = (e.type === 'touchmove') ? e.originalEvent.touches[0] : e;
		        movX = evt.pageX - touchX;

	        	if(typeof moveFn === 'function') {
		        	moveFn(movX);
		        }
		    };

		    stop = function( e ) {
		        // $el.off("touchmove", prevent);
		        $el.off("mousemove", prevent);
		        $el.off("touchmove", move);
		        $el.off("mousemove", move);

		    	if(typeof stopFn === 'function') {
		        	stopFn(movX);
		        }
		    };

		    $el.on("touchstart", start);
		    $el.on("mousedown", start);
		    $el.on("touchend", stop);
		    $el.on("touchleave", stop);
		    $el.on("touchcancel", stop);
		    $el.on("mouseup", stop);
		    $el.on("mouseleave", stop);
		},


		dynamicVal : function() {
			var $window = $( window ),
				update, 
				getViewportW, viewportW;

			update = function() {
 				viewportW = $window.width();
			};

			getViewportW = function() {
				return viewportW;
			};

			update();
			$window.on( 'load', update );
			$window.on( 'resize', update );

			return {
				viewportW : getViewportW
			};
		}
	};



	// 
	// Set of default animations
	// 
	// /////////////////////////////////////////////////////////

	MK.ui.Slider.prototype.animation = {

        slide : {
        	axis : 'X', 
            next : { transform: {} },
            active : { transform: {} },
            prev : { transform: {} }
        },

        vertical_slide : {
        	axis : 'Y',
            next : { transform: {} },
            active : { transform: {} },
            prev : { transform: {} }
        },

        perspective_flip : {
        	axis : 'Y',
            next : { 
            	transform: {
            		rotateX : 80
            	} 
            },
            active : { 
            	transform: {
            		rotateX : 0
            	} 
            },
            prev : { 
            	transform: {
            		rotateX : 0
            	} 
            }
        },

        zoom : {
			axis : 'Z',
            next: {
                opacity	: 0,
                transform : {
	                scale : 0.9
	            }
            },
            active: {
                opacity	: 1,
                transform : {
	                scale : 1
	            }
            },
            prev: {
                opacity	: 0,
                transform : {
	                scale : 1.1
	            }
            }
        },

        fade : {
			axis : 'Z',
            next: {
                opacity	: 0,
                transform : {}
            },
            active: {
                opacity	: 1,
                transform : {}
            },
            prev: {
                opacity	: 0,
                transform : {}
            }
        },

        kenburned : {
			axis : 'Z',
            next: {
                opacity	: 0,
                transform : {}
            },
            active: {
                opacity	: 1,
                transform : {}
            },
            prev: {
                opacity	: 0,
                transform : {}
            }
        },

        zoom_out : {
			axis : 'Z',
            next: {
				zIndex : '+',
                opacity	: 1,
                transform : {
	                translateY : 100,
	                scale : 1
	            }
            },
            active: {
                opacity	: 1,
                transform : {
	                translateY : 0,
	                scale : 1
	            }
            },
            prev: {
				zIndex : '+',
                opacity	: 0,
                transform : {
	                translateY : 0,
	                scale : 0.5
	            }
            }
        },

        // Problem with Z-Flow
        horizontal_curtain : {
			axis : 'Z',
            next: {
				zIndex : '+',
                transform : {
	                translateX : 100,
	            }
            },
            active: {
                transform : {
	                translateX : 0,
	            }
            },
            prev: {
				zIndex : '+',
                transform : {
	                translateX : -70,
	            }
            }
        },

		roulete : {
			axis : 'X',
            next: {
                opacity	: 0.5,
                transform : {
	                scale : 0.5,
	                rotate : 10,
	                translateY : 20
	            }
            },
            active: {
                opacity	: 1,
                transform : {
	                scale : 1,
	                rotate : 0,
	                translateY : 0
	            }
            },
            prev: {
                opacity	: 0.3,
                transform : {
	                scale : 0.5,
	                rotate : -10,
	                translateY : 20
	            }
            }
		}
	};



	// 
	// Penner's easing library
	// 
	// /////////////////////////////////////////////////////////

	MK.ui.Slider.prototype.ease = {
		/*
		 *
		 * TERMS OF USE - EASING EQUATIONS
		 * 
		 * Open source under the BSD License. 
		 * 
		 * Copyright Â© 2001 Robert Penner
		 * All rights reserved.
		 * 
		 * Redistribution and use in source and binary forms, with or without modification, 
		 * are permitted provided that the following conditions are met:
		 * 
		 * Redistributions of source code must retain the above copyright notice, this list of 
		 * conditions and the following disclaimer.
		 * Redistributions in binary form must reproduce the above copyright notice, this list 
		 * of conditions and the following disclaimer in the documentation and/or other materials 
		 * provided with the distribution.
		 * 
		 * Neither the name of the author nor the names of contributors may be used to endorse 
		 * or promote products derived from this software without specific prior written permission.
		 * 
		 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY 
		 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF
		 * MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE
		 * COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
		 * EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE
		 * GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED 
		 * AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
		 * NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED 
		 * OF THE POSSIBILITY OF SUCH DAMAGE. 
		 *
		 */
		linearEase : function(currentIteration, startValue, changeInValue, totalIterations) {
			return changeInValue * currentIteration / totalIterations + startValue;
		},

		easeInQuad : function(currentIteration, startValue, changeInValue, totalIterations) {
			return changeInValue * (currentIteration /= totalIterations) * currentIteration + startValue;
		},

		easeOutQuad : function(currentIteration, startValue, changeInValue, totalIterations) {
			return -changeInValue * (currentIteration /= totalIterations) * (currentIteration - 2) + startValue;
		},

		easeInOutQuad : function(currentIteration, startValue, changeInValue, totalIterations) {
			if ((currentIteration /= totalIterations / 2) < 1) {
				return changeInValue / 2 * currentIteration * currentIteration + startValue;
			}
			return -changeInValue / 2 * ((--currentIteration) * (currentIteration - 2) - 1) + startValue;
		},

		easeInCubic : function(currentIteration, startValue, changeInValue, totalIterations) {
			return changeInValue * Math.pow(currentIteration / totalIterations, 3) + startValue;
		},

		easeOutCubic : function(currentIteration, startValue, changeInValue, totalIterations) {
			return changeInValue * (Math.pow(currentIteration / totalIterations - 1, 3) + 1) + startValue;
		},

		easeInOutCubic : function(currentIteration, startValue, changeInValue, totalIterations) {
			if ((currentIteration /= totalIterations / 2) < 1) {
				return changeInValue / 2 * Math.pow(currentIteration, 3) + startValue;
			}
			return changeInValue / 2 * (Math.pow(currentIteration - 2, 3) + 2) + startValue;
		},

		easeInQuart : function(currentIteration, startValue, changeInValue, totalIterations) {
			return changeInValue * Math.pow (currentIteration / totalIterations, 4) + startValue;
		},

		easeOutQuart : function(currentIteration, startValue, changeInValue, totalIterations) {
			return -changeInValue * (Math.pow(currentIteration / totalIterations - 1, 4) - 1) + startValue;
		},

		easeInOutQuart : function(currentIteration, startValue, changeInValue, totalIterations) {
			if ((currentIteration /= totalIterations / 2) < 1) {
				return changeInValue / 2 * Math.pow(currentIteration, 4) + startValue;
			}
			return -changeInValue/2 * (Math.pow(currentIteration - 2, 4) - 2) + startValue;
		},

		easeInQuint : function(currentIteration, startValue, changeInValue, totalIterations) {
			return changeInValue * Math.pow (currentIteration / totalIterations, 5) + startValue;
		},

		easeOutQuint : function(currentIteration, startValue, changeInValue, totalIterations) {
			return changeInValue * (Math.pow(currentIteration / totalIterations - 1, 5) + 1) + startValue;
		},

		easeInOutQuint : function(currentIteration, startValue, changeInValue, totalIterations) {
			if ((currentIteration /= totalIterations / 2) < 1) {
				return changeInValue / 2 * Math.pow(currentIteration, 5) + startValue;
			}
			return changeInValue / 2 * (Math.pow(currentIteration - 2, 5) + 2) + startValue;
		},

		easeInSine : function(currentIteration, startValue, changeInValue, totalIterations) {
			return changeInValue * (1 - Math.cos(currentIteration / totalIterations * (Math.PI / 2))) + startValue;
		},

		easeOutSine : function(currentIteration, startValue, changeInValue, totalIterations) {
			return changeInValue * Math.sin(currentIteration / totalIterations * (Math.PI / 2)) + startValue;
		},

		easeInOutSine : function(currentIteration, startValue, changeInValue, totalIterations) {
			return changeInValue / 2 * (1 - Math.cos(Math.PI * currentIteration / totalIterations)) + startValue;
		},

		easeInExpo : function(currentIteration, startValue, changeInValue, totalIterations) {
			return changeInValue * Math.pow(2, 10 * (currentIteration / totalIterations - 1)) + startValue;
		},

		easeOutExpo : function(currentIteration, startValue, changeInValue, totalIterations) {
			return changeInValue * (-Math.pow(2, -10 * currentIteration / totalIterations) + 1) + startValue;
		},

		easeInOutExpo : function(currentIteration, startValue, changeInValue, totalIterations) {
			if ((currentIteration /= totalIterations / 2) < 1) {
				return changeInValue / 2 * Math.pow(2, 10 * (currentIteration - 1)) + startValue;
			}
			return changeInValue / 2 * (-Math.pow(2, -10 * --currentIteration) + 2) + startValue;
		},

		easeInCirc : function(currentIteration, startValue, changeInValue, totalIterations) {
			return changeInValue * (1 - Math.sqrt(1 - (currentIteration /= totalIterations) * currentIteration)) + startValue;
		},

		easeOutCirc : function(currentIteration, startValue, changeInValue, totalIterations) {
			return changeInValue * Math.sqrt(1 - (currentIteration = currentIteration / totalIterations - 1) * currentIteration) + startValue;
		},

		easeInOutCirc : function(currentIteration, startValue, changeInValue, totalIterations) {
			if ((currentIteration /= totalIterations / 2) < 1) {
				return changeInValue / 2 * (1 - Math.sqrt(1 - currentIteration * currentIteration)) + startValue;
			}
			return changeInValue / 2 * (Math.sqrt(1 - (currentIteration -= 2) * currentIteration) + 1) + startValue;
		}
	};

})(jQuery);
/* Social Share */
/* -------------------------------------------------------------------- */
(function($) {
    'use strict';
	
    MK.component.SocialShare = function( el ) {
        var networks = {
			twitter : 'http://twitter.com/intent/tweet?text={title} {url}',
			pinterest : 'http://pinterest.com/pin/create/button/?url={url}&media={image}&description={title}',
			facebook : 'https://www.facebook.com/sharer/sharer.php?u={url}',
			googleplus : 'https://plus.google.com/share?url={url}',
			linkedin : 'http://www.linkedin.com/shareArticle?mini=true&url={url}&title={title}&summary={desc}'
        };

        this.networks = networks;
        this.el = el;
    };
	
	
	MK.component.SocialShare.prototype = {

        init : function() {
            this.cacheElements();
            this.bindEvents();
        },

        cacheElements : function() {
            this.$this  = $( this.el );
           
           
        },

        bindEvents : function() {
			var thisObject = this;
			var tempClass = "";
			$.each(this.networks, function( key, value ) {
				  thisObject.$tempClass = $('.' + key + '-share');
				  thisObject.$tempClass.click(thisObject.openSharingDialog.bind(self, this, key));
				
			});
        },
		
        openSharingDialog : function(url, site, args) {
			var urlWrapper = url;
			var rx = new RegExp('\{[a-z]*\}','g'), res;
			match = rx.exec(url);
			while (match != null) {
				var pureAttr = match[0].replace("{", "").replace("}" , "");
				var attValue = $(args.currentTarget).attr('data-' + pureAttr);
				if (attValue === undefined || attValue === null) {
					attValue = "";
				}
				attValue = attValue.replace('#', '%23'); // fix for twitter description 
				urlWrapper = urlWrapper.replace(match, attValue);
				match = rx.exec(url);
			}
			
			window.open(urlWrapper, site + "Window", "height=320,width=660,resizable=0,toolbar=0,menubar=0,status=0,location=0,scrollbars=0");
            
        },

       
    };
	
	
	//////////////////////////////////////////
    //
    // Apply to:
    //
    // ///////////////////////////////////////

    var $body = $('body');

    if(!$body.length) return;

    $body.each(function() {
        var socialShare = new MK.component.SocialShare(this);
			socialShare.init();
    });
	
})(jQuery);



//function mk_social_share() {
//
//  "use strict";
//
//  $('.twitter-share').on('click', function () {
//    var $url = $(this).attr('data-url'),
//      $title = $(this).attr('data-title');
//
//    window.open('http://twitter.com/intent/tweet?text=' + $title + ' ' + $url, "twitterWindow", "height=380,width=660,resizable=0,toolbar=0,menubar=0,status=0,location=0,scrollbars=0");
//    return false;
//  });
//
//  $('.pinterest-share').on('click', function () {
//    var $url = $(this).attr('data-url'),
//      $title = $(this).attr('data-title'),
//      $image = $(this).attr('data-image');
//    window.open('http://pinterest.com/pin/create/button/?url=' + $url + '&media=' + $image + '&description=' + $title, "twitterWindow", "height=320,width=660,resizable=0,toolbar=0,menubar=0,status=0,location=0,scrollbars=0");
//    return false;
//  });
//
//  $('.facebook-share').on('click', function () {
//    var $url = $(this).attr('data-url');
//    window.open('https://www.facebook.com/sharer/sharer.php?u=' + $url, "facebookWindow", "height=380,width=660,resizable=0,toolbar=0,menubar=0,status=0,location=0,scrollbars=0");
//    return false;
//  });
//
//  $('.googleplus-share').on('click', function () {
//    var $url = $(this).attr('data-url');
//    window.open('https://plus.google.com/share?url=' + $url, "googlePlusWindow", "height=380,width=660,resizable=0,toolbar=0,menubar=0,status=0,location=0,scrollbars=0");
//    return false;
//  });
//
//  $('.linkedin-share').on('click', function () {
//    var $url = $(this).attr('data-url'),
//      $title = $(this).attr('data-title'),
//      $desc = $(this).attr('data-desc');
//    window.open('http://www.linkedin.com/shareArticle?mini=true&url=' + $url + '&title=' + $title + '&summary=' + $desc, "linkedInWindow", "height=380,width=660,resizable=0,toolbar=0,menubar=0,status=0,location=0,scrollbars=0");
//    return false;
//  });
//}




(function($) {
	'use strict';

	MK.component.Sortable = function(el) {
		this.el = el; 
	};

	MK.component.Sortable.prototype = {
		init: function init() {
			this.cacheElements();
			this.bindEvents();
		},

		cacheElements: function cacheElements() {
			this.unique = Date.now();
			this.$filter = $(this.el);
			this.config = this.$filter.data('sortable-config');

			this.ajaxLoader = new MK.utils.ajaxLoader(this.config.container);
			this.ajaxLoader.init();

			this.$container = $( this.config.container );
			this.$navItems = this.$filter.find('a');
			this.$filterItems = this.$container.find(this.config.item);
		},

		bindEvents: function bindEvents() {
			this.$navItems.on('click', this.handleClick.bind(this));
			MK.utils.eventManager.subscribe('ajaxLoaded', this.onLoad.bind(this));
		},

		handleClick: function handleClick(e) {
			e.preventDefault();

			var $item = $(e.currentTarget);
			var term = $item.data('filter');

			this.$navItems.removeClass('current');
			$item.addClass('current');

			if(this.config.mode === 'ajax') this.inDB(term, $item);
	        else this.inPage(term);
		},

		inDB: function inDB(term, $item) { 
			// Add load indicator only for long requests
			MK.ui.loader.remove(this.$filter);
			MK.ui.loader.add($item);
			
			// If mk-ajax-loaded-posts span exists and one of the filter is clicked,
			// clear post ids
			if ( this.$container.siblings('.mk-ajax-loaded-posts').length ) {		
				this.$container.siblings('.mk-ajax-loaded-posts').attr('data-loop-loaded-posts', '');
			}

			this.ajaxLoader.setData({
				paged: 1,
				term: term
			});
            this.ajaxLoader.load(this.unique);
		},

		inPage: function inPage(term) {
			var $filterItems = this.$container.find(this.config.item);
			$filterItems.removeClass('is-hidden'); // show all first
			if(term !== '*') $filterItems.not('.' + term).addClass('is-hidden'); // hide filtered
			MK.utils.eventManager.publish('staticFilter');
		},

		onLoad: function onLoad(e, response) {
			if(this.config.mode === 'static') {
				this.$navItems.removeClass('current').first().addClass('current');
			}
			if( typeof response !== 'undefined' &&  response.id === this.config.container) {
				MK.ui.loader.remove(this.$filter);
				if(response.unique === this.unique) {
		            this.$container.html(response.content);
					this.ajaxLoader.setData({paged: 1});
				}
			}
		}
	};

})(jQuery);
(function($) {
    'use strict';

    MK.component.Tabs = function( el ) {
        var defaults = {
            activeClass : 'is-active'
        };

        this.config = defaults;
        this.el = el;
    };

    MK.component.Tabs.prototype = {

        init : function() {
            this.cacheElements();
            this.bindEvents();
        },

        cacheElements : function() {
            this.$this  = $( this.el );
            this.$tabs  = this.$this.find( '.mk-tabs-tab' );
            this.$panes = this.$this.find( '.mk-tabs-pane' );
            this.currentId = 0;
        },

        bindEvents : function() {
            var self = this;

            this.$tabs.on( 'click', this.switchPane.bind( this ) );
        },

        switchPane : function( evt ) {
            evt.preventDefault();

            var clickedId = $( evt.currentTarget ).index();

            this.hide( this.currentId );
            this.show( clickedId );

            // Update current id
            this.currentId = clickedId;

            // Notify rest of the app
            MK.utils.eventManager.publish('item-expanded');            
        },

        show : function( id ) {
            this.$tabs.eq( id ).addClass( this.config.activeClass );
            this.$panes.eq( id ).addClass( this.config.activeClass );
        },

        hide : function( id ) {
            this.$tabs.eq( id ).removeClass( this.config.activeClass );
            this.$panes.eq( id ).removeClass( this.config.activeClass );
        }
    };

})(jQuery);


/* Tabs */
/* -------------------------------------------------------------------- */

function mk_tabs() {

  // "use strict";

  // if ($.exists('.mk-tabs, .mk-news-tab, .mk-woo-tabs')) {
  //   $(".mk-tabs, .mk-news-tab, .mk-woo-tabs").tabs();

  //    $('.mk-tabs').on('click', function () {
  //      $('.mk-theme-loop').isotope('layout');
  //    });

  //   $('.mk-tabs.vertical-style').each(function () {
  //     $(this).find('.mk-tabs-pane').css('minHeight', $(this).find('.mk-tabs-tabs').height() - 1);
  //   });

  // }
}

function mk_tabs_responsive(){
  // $('.mk-tabs, .mk-news-tab').each(function () {
  //   $this = $(this);
  //   if ($this.hasClass('mobile-true')) {
  //     if (window.matchMedia('(max-width: 767px)').matches)
  //     {
  //         $this.tabs("destroy");
  //     } else {
  //       $this.tabs();
  //     }
  //   }
  // });
  
}


(function($) {
  'use strict';

  $(document).on('click', function(e) {
    $('.mk-toggle-trigger').removeClass('mk-toggle-active');
  });

  function toggle(e) {
      e.preventDefault();
      e.stopPropagation();
      var $this = $(e.currentTarget);

      if (!$this.hasClass('mk-toggle-active')) {

        $('.mk-box-to-trigger').fadeOut(200);
        $this.parent().find('.mk-box-to-trigger').fadeIn(250);
        $('.mk-toggle-trigger').removeClass('mk-toggle-active');
        $this.addClass('mk-toggle-active');

      } else {

        $('.mk-box-to-trigger').fadeOut(200);
        $this.removeClass('mk-toggle-active');

      }
  }

  function assignToggle() {
    // wait for ajax response propagation and insertion
    setTimeout(function() {
      $('.mk-toggle-trigger').off('click', toggle);
      $('.mk-toggle-trigger').on('click', toggle);
    }, 100);
  }

  assignToggle();
  MK.utils.eventManager.subscribe('ajaxLoaded', assignToggle);
  MK.utils.eventManager.subscribe('ajax-preview', assignToggle);

}(jQuery));
(function($) {
	'use strict';

	var $iframes = $('iframe');

	$iframes.each(function() {
		var $iframe = $(this);
		var parent = $iframe.parent().get(0);
		var tagName = parent.tagName;

		if(tagName === 'P') $iframe.wrap('<div class="mk-video-container"></div>');
	});

}(jQuery));
(function( $ ) {
    'use strict';

    if( MK.utils.isMobile() ) {
        $('.mk-animate-element').removeClass('mk-animate-element');
        return;
    }

    // TODO solidify by one class name like js-master-wrapper and apply it to dom
    var $rootLevelEls = $('.js-master-row, .widget');


    var init = function init() {
        $rootLevelEls.each( spyViewport );
        $rootLevelEls.each( function rootLevelEl() {
            var $animateEl = $(this).find( '.mk-animate-element' );
            $animateEl.each( spyViewport );
        });   
    };

    var spyViewport = function spyViewport(i) {
        var self = this;

        MK.utils.scrollSpy( this, {
            position  : 'bottom',
            threshold : 200,
            after     : function() {
                animate.call(self, i);
            }
        });
    };

    var animate = function animate(i) {
        var $this = $(this);

        setTimeout(function() {
            $this.addClass( 'mk-in-viewport' );
        }, 100 * i);
    };


    $(window).on('load', init);

}(jQuery));
(function($) {
	'use strict';

	$(document).on('change', '.variations_form select', moveToFirstSlide);

	function moveToFirstSlide() {
		var $switcher = $('.variations_form select'),
			$wrapper = $switcher.parents('.mk-product'),
			id = $wrapper.find('.mk-slider-holder').parent().attr('id');

		MK.utils.eventManager.publish('gallery-update', {
			id: id
		});
	}

}(jQuery));
// (function($) {
//     'use strict';
	
//     MK.component.WoocommerceAddToCard = function( el ) {
//         var defaults = {
//             addToCardIcon : '<svg class="mk-svg-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M437.011 74.99c-46.326-46.328-110.318-74.99-181.011-74.99-109.744 0-203.345 69.064-239.749 166.094l59.938 22.477c27.302-72.773 97.503-124.571 179.811-124.571 53.02 0 101.01 21.5 135.753 56.247l-71.753 71.753h192v-192l-74.989 74.99zm-181.011 373.01c-53.02 0-101.013-21.496-135.756-56.244l71.756-71.756h-192v192l74.997-74.997c46.323 46.331 110.309 74.997 181.003 74.997 109.745 0 203.346-69.064 239.75-166.094l-59.938-22.477c-27.302 72.773-97.503 124.571-179.812 124.571z"/></svg>',
// 			addedToCardIcon : '<svg class="mk-svg-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M432 64l-240 240-112-112-80 80 192 192 320-320z"/></svg>'
			
//         },addToCardButton, addToCardIconHolder, iconWrapper;

//         this.config = defaults;
//         this.el = el;
// 		//var self = this;
		
		
		
//     };
	
	
// 	MK.component.WoocommerceAddToCard.prototype = {

//         init : function() {
//             this.cacheElements();
//             this.bindEvents();
//         },

//         cacheElements : function() {
//             this.$this  = $( this.el );
//             this.$addToCardButton  = $('.add_to_cart_button');
//             this.$addToCardIconHolder  = this.getCardIconHolder(this.$addToCardButton);
//             this.$iconWrapper = this.getIconWrapper(this.$addToCardIconHolder);
           
//         },

//         bindEvents : function() {
        
//             this.$addToCardButton.on( 'click', this.showLoading.bind( self, this) );
//             this.$this.bind( 'added_to_cart', this.showSuccess.bind( self, this) );
			
//         },
		
// 		getCardIconHolder : function (addToCardButton) {
// 			return addToCardButton.parents('.product:eq(0)');
// 		},
		
//         getIconWrapper : function (addToCardIconHolder) {
// 			return addToCardIconHolder.find('.product-loading-icon');
// 		},
		
//         showLoading : function(e, args) {
			
// 			e.$addToCardIconHolder.addClass('adding-to-cart').removeClass('added-to-cart');
// 			e.$iconWrapper.html(e.config.addToCardIcon);
            
//         },

//         showSuccess : function(e, args) {
//              e.$addToCardIconHolder.removeClass('adding-to-cart').addClass('added-to-cart');
// 			 e.$iconWrapper.html(e.config.addedToCardIcon);
//         }
//     };
	
	
// 	 // ///////////////////////////////////////
//     //
//     // Apply to:
//     //
//     // ///////////////////////////////////////

//     var $body = $('body');

//     if(!$body.length) return;

//     $body.each(function() {
//         var addToCardButton = new MK.component.WoocommerceAddToCard(this);
// 			addToCardButton.init();
//     });
	
// })(jQuery);



function product_loop_add_cart() {
 var $body = $('body');

 $body.on('click', '.add_to_cart_button', function () {
     var icon = '<svg class="mk-svg-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M437.011 74.99c-46.326-46.328-110.318-74.99-181.011-74.99-109.744 0-203.345 69.064-239.749 166.094l59.938 22.477c27.302-72.773 97.503-124.571 179.811-124.571 53.02 0 101.01 21.5 135.753 56.247l-71.753 71.753h192v-192l-74.989 74.99zm-181.011 373.01c-53.02 0-101.013-21.496-135.756-56.244l71.756-71.756h-192v192l74.997-74.997c46.323 46.331 110.309 74.997 181.003 74.997 109.745 0 203.346-69.064 239.75-166.094l-59.938-22.477c-27.302 72.773-97.503 124.571-179.812 124.571z"/></svg>';
     var $holder = $(this).parents('.product:eq(0)');
     var $i = $holder.find('.product-loading-icon');

     $holder.addClass('adding-to-cart').removeClass('added-to-cart');
     $i.html(icon);
 });

 $body.bind('added_to_cart', function () {
     var icon = '<svg class="mk-svg-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M432 64l-240 240-112-112-80 80 192 192 320-320z"/></svg>';
     var $holder = $('.adding-to-cart');
     var $i = $holder.find('.product-loading-icon');

     $holder.removeClass('adding-to-cart').addClass('added-to-cart');
     $i.html(icon);
 });
 
 

}

(function($) {
    'use strict';

    /**
     * Entry point of application. Runs all components
     */
    $( window ).on( 'load', function() {
        MK.core.initAll( document );
        MK.utils.scrollToURLHash();
        // TODO move preloader to components and manage it state from within
        setTimeout( function() { 
            MK.ui.preloader.hide(); // site wide 
            $('.mk-preloader').hide(); // components
            $('body').removeClass('loading');
        }, 150 ); 
    });

    /**
     * Assign global click handlers
     */
    $( document ).on( 'click', '.js-smooth-scroll, .js-main-nav a', smoothScrollToAnchor);
    $( '.side_dashboard_menu a' ).on( 'click', smoothScrollToAnchor);

    function smoothScrollToAnchor( evt ) {
        var anchor = MK.utils.detectAnchor( this );
        var $this = $(evt.currentTarget);
        var loc = window.location;
        var currentPage = loc.origin + loc.pathname;
        var href = $this.attr( 'href' );
        var linkSplit = (href) ? href.split( '#' ) : '';
        var hrefPage  = linkSplit[0] ? linkSplit[0] : ''; 
        var hrefHash  = linkSplit[1] ? linkSplit[1] : '';

        if( anchor.length ) {
            if(hrefPage === currentPage || hrefPage === '') evt.preventDefault();
            MK.utils.scrollToAnchor( anchor );

        } else if( $this.attr( 'href' ) === '#' ) {
            evt.preventDefault();
        }
    }
    
}(jQuery));}(jQuery))