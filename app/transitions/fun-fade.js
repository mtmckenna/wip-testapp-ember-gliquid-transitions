import { stop, Promise } from "liquid-fire";
import D2I from 'npm:dom-to-image';
import createTexture from 'npm:gl-texture2d';
import createTransition from 'npm:glsl-transition';
import raf from 'npm:raf';
import RSVP from 'rsvp';

const D2I_OPTS = { style: { visibility: 'visible' } };

const PIXELIZE_TRANSITION = {
  "glsl" : "#ifdef GL_ES\nprecision highp float;\n#endif\nuniform sampler2D from, to;\nuniform float progress;\nuniform vec2 resolution;\n\nfloat rand(vec2 co){\n  return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);\n}\n\nvoid main() {\n  float revProgress = (1.0 - progress);\n  float distFromEdges = min(progress, revProgress);\n  float squareSize = (50.0 * distFromEdges) + 1.0;  \n  \n  vec2 p = (floor((gl_FragCoord.xy + squareSize * 0.5) / squareSize) * squareSize) / resolution.xy;\n  vec4 fromColor = texture2D(from, p);\n  vec4 toColor = texture2D(to, p);\n  \n  gl_FragColor = mix(fromColor, toColor, progress);\n}",
  "uniforms": { "persp": 0.7, "unzoom": 0.3, "reflection": 0.4, "floating": 3.0 }
};

var CUBE_TRANSITION = {
  "glsl" : "#ifdef GL_ES\nprecision highp float;\n#endif\nuniform sampler2D from, to;\nuniform float progress;\nuniform vec2 resolution;\n\nuniform float persp;\nuniform float unzoom;\nuniform float reflection;\nuniform float floating;\n\nvec2 project (vec2 p) {\n  return p * vec2(1.0, -1.2) + vec2(0.0, -floating/100.);\n}\n\nbool inBounds (vec2 p) {\n  return all(lessThan(vec2(0.0), p)) && all(lessThan(p, vec2(1.0)));\n}\n\nvec4 bgColor (vec2 p, vec2 pfr, vec2 pto) {\n  vec4 c = vec4(0.0, 0.0, 0.0, 1.0);\n  pfr = project(pfr);\n  if (inBounds(pfr)) {\n    c += mix(vec4(0.0), texture2D(from, pfr), reflection * mix(1.0, 0.0, pfr.y));\n  }\n  pto = project(pto);\n  if (inBounds(pto)) {\n    c += mix(vec4(0.0), texture2D(to, pto), reflection * mix(1.0, 0.0, pto.y));\n  }\n  return c;\n}\n\n// p : the position\n// persp : the perspective in [ 0, 1 ]\n// center : the xcenter in [0, 1] \\ 0.5 excluded\nvec2 xskew (vec2 p, float persp, float center) {\n  float x = mix(p.x, 1.0-p.x, center);\n  return (\n    (\n      vec2( x, (p.y - 0.5*(1.0-persp) * x) / (1.0+(persp-1.0)*x) )\n      - vec2(0.5-distance(center, 0.5), 0.0)\n    )\n    * vec2(0.5 / distance(center, 0.5) * (center<0.5 ? 1.0 : -1.0), 1.0)\n    + vec2(center<0.5 ? 0.0 : 1.0, 0.0)\n  );\n}\n\nvoid main() {\n  vec2 op = gl_FragCoord.xy / resolution.xy;\n  float uz = unzoom * 2.0*(0.5-distance(0.5, progress));\n  vec2 p = -uz*0.5+(1.0+uz) * op;\n  vec2 fromP = xskew(\n    (p - vec2(progress, 0.0)) / vec2(1.0-progress, 1.0),\n    1.0-mix(progress, 0.0, persp),\n    0.0\n  );\n  vec2 toP = xskew(\n    p / vec2(progress, 1.0),\n    mix(pow(progress, 2.0), 1.0, persp),\n    1.0\n  );\n  if (inBounds(fromP)) {\n    gl_FragColor = texture2D(from, fromP);\n  }\n  else if (inBounds(toP)) {\n    gl_FragColor = texture2D(to, toP);\n  }\n  else {\n    gl_FragColor = bgColor(op, fromP, toP);\n  }\n}",
  "uniforms": { "persp": 0.7, "unzoom": 0.3, "reflection": 0.4, "floating": 3.0 }
};

export default function funFade() {
  stop(this.oldElement);
  var canvas = createCanvasOnTopOfElement(this.oldElement);

  var convertOldElementToImage = D2I.toPng(this.oldElement[0]).then((dataUrl) => {
    this.oldElement.css({visibility: 'hidden'});
    return imageFromDataUrl(dataUrl);
  }).catch(function (error) {
    console.error('Error converting the old element to an image.', error);
  });

  var convertNewElementToImage = D2I.toPng(this.newElement[0], D2I_OPTS).then((dataUrl) => {
    return imageFromDataUrl(dataUrl);
  }).catch(function (error) {
    console.error('Error converting the new element to an image.', error);
  });

  return RSVP.hash({
    fromImage: convertOldElementToImage,
    toImage: convertNewElementToImage
  }).then(function(hash) {
    return animateTransition(canvas, PIXELIZE_TRANSITION, hash.fromImage, hash.toImage);
  }).then(() => {
    showNewElement(this.newElement);
  });
}

function showNewElement(newElement) {
  if (newElement) {
    newElement.css({visibility: 'visible'});
  }
}

function createCanvasOnTopOfElement($element) {
  var canvas = document.createElement('canvas');
  canvas.style.display = 'block';
  canvas.style.position = 'absolute';
  canvas.style.top = $element.offset().top + 'px';
  canvas.style.left = $element.offset().left + 'px';
  canvas.width = $element.width();
  canvas.height = $element.height();

  return canvas;
}

function imageFromDataUrl(dataUrl) {
  var img = new Image();
  img.src = dataUrl;
  return img;
}

function configureGl(gl) {
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
}

function texturesFromImages(gl, fromImage, toImage) {
  return {
    to: createTexture(gl, toImage),
    from: createTexture(gl, fromImage)
  };
}

function animationLoop(transition, fromTexture, toTexture, uniforms, duration, finishedCallback) {
  var start = null;
  raf(function loop (timestamp) {
    var handle = raf(loop);
    if (!start) { start = timestamp; }
    var progress = ((timestamp - start) / duration) / 1.0;

    if (progress > 1.0) {
      raf.cancel(handle);
      finishedCallback();
    }

    transition.render(progress, fromTexture, toTexture, uniforms);
  });
}

function animateTransition(canvas, transitionData, fromImage, toImage) {
  var gl = canvas.getContext('webgl');
  if (!gl) { console.error('Unable to get WebGL context.'); }

  document.body.appendChild(canvas);
  configureGl(gl);
  var { from, to } = texturesFromImages(gl, fromImage, toImage);
  var transition = createTransition(gl, transitionData.glsl);

  return new Promise(function(resolve) {
    animationLoop(transition, from, to, transitionData.uniforms, 1000.0, function() {
      document.body.removeChild(canvas);
      resolve();
    });
  });
}
