// BEGIN-SNIPPET cross-fade-definition
import { animate, stop, Promise } from "liquid-fire";
import D2I from 'npm:dom-to-image';

export default function funFade(opts={}) {
  console.log('ogoose');
  stop(this.oldElement);
  D2I.toPng(this.newElement).then(function (dataUrl) {
    console.log('hi');
    var img = new Image();
    img.src = dataUrl;
    document.body.appendChild(img);
  }).catch(function (error) {
    console.error('oops, something went wrong!', error);
  });

  return Promise.all([
    animate(this.oldElement, {opacity: 0}, opts),
    animate(this.newElement, {opacity: [(opts.maxOpacity || 1), 0], backgroundColor: "#ff0000"}, opts)
  ]);
}
// END-SNIPPET
