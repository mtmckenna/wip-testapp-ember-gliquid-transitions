import Ember from 'ember';
import D2I from 'npm:dom-to-image';

export default Ember.Component.extend({
  didInsertElement() {
    this._super(...arguments);
    var node = $('body')[0];
    D2I.toPng(node)
      .then(function (dataUrl) {
        var img = new Image();
        img.src = dataUrl;
        //document.body.appendChild(img);
      })
      .catch(function (error) {
        console.error('oops, something went wrong!', error);
      });
  }
});
