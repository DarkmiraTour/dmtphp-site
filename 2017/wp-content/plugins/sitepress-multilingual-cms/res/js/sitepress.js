"use strict";

var icl_vars = {"current_language":"pt-br","icl_home":"https:\/\/php.darkmiratour.rocks\/2017\/","ajax_url":"https:\/\/php.darkmiratour.rocks\/2017\/wp-admin\/admin-ajax.php","url_type":"1"};
var icl_lang = icl_vars.current_language;
var icl_home = icl_vars.icl_home;

function addLoadEvent(func) {
  var oldonload = window.onload;
  if (typeof window.onload != 'function') {
    window.onload = func;
  } else {
    window.onload = function() {
      if (oldonload) {
        oldonload();
      }
      func();
    }
  }  
}
