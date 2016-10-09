// BEGIN-SNIPPET cross-fade-definition
import { animate, stop, Promise } from "liquid-fire";
import D2I from 'npm:dom-to-image';
import createTexture from 'npm:gl-texture2d';
import createTransition from 'npm:glsl-transition';
import raf from 'npm:raf';
import RSVP from 'rsvp';

export default function funFade(opts={}) {
  stop(this.oldElement);
  var rawOldElement = this.oldElement.get(0);
  var rawNewElement = this.newElement.get(0);
  this.oldElement.css({visibility: 'visible'});

  var canvas = document.createElement('canvas');
  canvas.style.display = 'block';
  canvas.style.position = 'absolute';
  canvas.style.top = this.oldElement.offset().top + 'px';
  canvas.style.left = this.oldElement.offset().left + 'px';
  canvas.width = this.oldElement.width();
  canvas.height = this.oldElement.height();

  this.newElement.css({top: 0, left: 0});
  var convertOldElementToImage = D2I.toPng(rawOldElement).then((dataUrl) => {
    var img = new Image();
    img.src = dataUrl;
    this.oldElement.css({visibility: 'hidden'});
    return img;
  }).catch(function (error) {
    console.error('oops, something went wrong!', error);
  });

  //var styles = {style: {visibility: 'visible', top: 0, left: 0}};
  var styles = {style: {}};

  var convertNewElementToImage = D2I.toPng(rawNewElement, styles).then((dataUrl) => {
    var img = new Image();
    img.src = dataUrl;
    return img;
  }).catch(function (error) {
    console.error('oops, something went wrong!', error);
  });

  return RSVP.hash({
    fromImage: convertOldElementToImage,
    toImage: convertNewElementToImage
  }).then(function(hash) {
    return doTheThing(canvas, hash.fromImage, hash.toImage);
  }).then(() => {
    this.newElement.css({visibility: 'visible'});
  });
}

function doTheThing(canvas, fromImage, toImage) {
      //"glsl" : "#ifdef GL_ES\nprecision highp float;\n#endif\nuniform sampler2D from, to;\nuniform float progress;\nuniform vec2 resolution;\n\nuniform float persp;\nuniform float unzoom;\nuniform float reflection;\nuniform float floating;\n\nvec2 project (vec2 p) {\n  return p * vec2(1.0, -1.2) + vec2(0.0, -floating/100.);\n}\n\nbool inBounds (vec2 p) {\n  return all(lessThan(vec2(0.0), p)) && all(lessThan(p, vec2(1.0)));\n}\n\nvec4 bgColor (vec2 p, vec2 pfr, vec2 pto) {\n  vec4 c = vec4(0.0, 0.0, 0.0, 1.0);\n  pfr = project(pfr);\n  if (inBounds(pfr)) {\n    c += mix(vec4(0.0), texture2D(from, pfr), reflection * mix(1.0, 0.0, pfr.y));\n  }\n  pto = project(pto);\n  if (inBounds(pto)) {\n    c += mix(vec4(0.0), texture2D(to, pto), reflection * mix(1.0, 0.0, pto.y));\n  }\n  return c;\n}\n\n// p : the position\n// persp : the perspective in [ 0, 1 ]\n// center : the xcenter in [0, 1] \\ 0.5 excluded\nvec2 xskew (vec2 p, float persp, float center) {\n  float x = mix(p.x, 1.0-p.x, center);\n  return (\n    (\n      vec2( x, (p.y - 0.5*(1.0-persp) * x) / (1.0+(persp-1.0)*x) )\n      - vec2(0.5-distance(center, 0.5), 0.0)\n    )\n    * vec2(0.5 / distance(center, 0.5) * (center<0.5 ? 1.0 : -1.0), 1.0)\n    + vec2(center<0.5 ? 0.0 : 1.0, 0.0)\n  );\n}\n\nvoid main() {\n  vec2 op = gl_FragCoord.xy / resolution.xy;\n  float uz = unzoom * 2.0*(0.5-distance(0.5, progress));\n  vec2 p = -uz*0.5+(1.0+uz) * op;\n  vec2 fromP = xskew(\n    (p - vec2(progress, 0.0)) / vec2(1.0-progress, 1.0),\n    1.0-mix(progress, 0.0, persp),\n    0.0\n  );\n  vec2 toP = xskew(\n    p / vec2(progress, 1.0),\n    mix(pow(progress, 2.0), 1.0, persp),\n    1.0\n  );\n  if (inBounds(fromP)) {\n    gl_FragColor = texture2D(from, fromP);\n  }\n  else if (inBounds(toP)) {\n    gl_FragColor = texture2D(to, toP);\n  }\n  else {\n    gl_FragColor = bgColor(op, fromP, toP);\n  }\n}",
  return new Promise(function(resolve) {
    var CubeTransition = { // from "glsl-transitions"
  "glsl" : "#ifdef GL_ES\nprecision highp float;\n#endif\nuniform sampler2D from, to;\nuniform float progress;\nuniform vec2 resolution;\n\nfloat rand(vec2 co){\n  return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);\n}\n\nvoid main() {\n  float revProgress = (1.0 - progress);\n  float distFromEdges = min(progress, revProgress);\n  float squareSize = (50.0 * distFromEdges) + 1.0;  \n  \n  vec2 p = (floor((gl_FragCoord.xy + squareSize * 0.5) / squareSize) * squareSize) / resolution.xy;\n  vec4 fromColor = texture2D(from, p);\n  vec4 toColor = texture2D(to, p);\n  \n  gl_FragColor = mix(fromColor, toColor, progress);\n}",
  "uniforms": { "persp": 0.7, "unzoom": 0.3, "reflection": 0.4, "floating": 3.0 }
    };

    var gl = canvas.getContext("webgl");
    if (!gl) throw new Error("webgl context is not supported.");
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

    var to = createTexture(gl, toImage);
    var from = createTexture(gl, fromImage);

    var transition = createTransition(gl, CubeTransition.glsl);
    var start = null;

    document.body.appendChild(canvas);
    raf(function loop (timestamp) {
      var handle = raf(loop);
      if (!start) start = timestamp;
      var progress = ((timestamp - start) / 1000.0) / 1.0;

      if (progress > 1.0) {
        raf.cancel(handle);
        document.body.removeChild(canvas);
        resolve();
      };

      transition.render(progress, from, to, CubeTransition.uniforms);
    });
  });
}
