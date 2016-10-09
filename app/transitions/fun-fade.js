import { stop, Promise } from "liquid-fire";
import D2I from 'npm:dom-to-image';
import createTexture from 'npm:gl-texture2d';
import createTransition from 'npm:glsl-transition';
import raf from 'npm:raf';
import RSVP from 'rsvp';

const DURATION = 1000.0;

const TRANSITIONS = {
  pixelize: {
    "glsl" : "#ifdef GL_ES\nprecision highp float;\n#endif\nuniform sampler2D from, to;\nuniform float progress;\nuniform vec2 resolution;\n\nfloat rand(vec2 co){\n  return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);\n}\n\nvoid main() {\n  float revProgress = (1.0 - progress);\n  float distFromEdges = min(progress, revProgress);\n  float squareSize = (50.0 * distFromEdges) + 1.0;  \n  \n  vec2 p = (floor((gl_FragCoord.xy + squareSize * 0.5) / squareSize) * squareSize) / resolution.xy;\n  vec4 fromColor = texture2D(from, p);\n  vec4 toColor = texture2D(to, p);\n  \n  gl_FragColor = mix(fromColor, toColor, progress);\n}",
  "uniforms": { "persp": 0.7, "unzoom": 0.3, "reflection": 0.4, "floating": 3.0 }
  },
  cube: {
    "glsl" : "#ifdef GL_ES\nprecision highp float;\n#endif\nuniform sampler2D from, to;\nuniform float progress;\nuniform vec2 resolution;\n\nuniform float persp;\nuniform float unzoom;\nuniform float reflection;\nuniform float floating;\n\nvec2 project (vec2 p) {\n  return p * vec2(1.0, -1.2) + vec2(0.0, -floating/100.);\n}\n\nbool inBounds (vec2 p) {\n  return all(lessThan(vec2(0.0), p)) && all(lessThan(p, vec2(1.0)));\n}\n\nvec4 bgColor (vec2 p, vec2 pfr, vec2 pto) {\n  vec4 c = vec4(0.0, 0.0, 0.0, 1.0);\n  pfr = project(pfr);\n  if (inBounds(pfr)) {\n    c += mix(vec4(0.0), texture2D(from, pfr), reflection * mix(1.0, 0.0, pfr.y));\n  }\n  pto = project(pto);\n  if (inBounds(pto)) {\n    c += mix(vec4(0.0), texture2D(to, pto), reflection * mix(1.0, 0.0, pto.y));\n  }\n  return c;\n}\n\n// p : the position\n// persp : the perspective in [ 0, 1 ]\n// center : the xcenter in [0, 1] \\ 0.5 excluded\nvec2 xskew (vec2 p, float persp, float center) {\n  float x = mix(p.x, 1.0-p.x, center);\n  return (\n    (\n      vec2( x, (p.y - 0.5*(1.0-persp) * x) / (1.0+(persp-1.0)*x) )\n      - vec2(0.5-distance(center, 0.5), 0.0)\n    )\n    * vec2(0.5 / distance(center, 0.5) * (center<0.5 ? 1.0 : -1.0), 1.0)\n    + vec2(center<0.5 ? 0.0 : 1.0, 0.0)\n  );\n}\n\nvoid main() {\n  vec2 op = gl_FragCoord.xy / resolution.xy;\n  float uz = unzoom * 2.0*(0.5-distance(0.5, progress));\n  vec2 p = -uz*0.5+(1.0+uz) * op;\n  vec2 fromP = xskew(\n    (p - vec2(progress, 0.0)) / vec2(1.0-progress, 1.0),\n    1.0-mix(progress, 0.0, persp),\n    0.0\n  );\n  vec2 toP = xskew(\n    p / vec2(progress, 1.0),\n    mix(pow(progress, 2.0), 1.0, persp),\n    1.0\n  );\n  if (inBounds(fromP)) {\n    gl_FragColor = texture2D(from, fromP);\n  }\n  else if (inBounds(toP)) {\n    gl_FragColor = texture2D(to, toP);\n  }\n  else {\n    gl_FragColor = bgColor(op, fromP, toP);\n  }\n}",
  "uniforms": { "persp": 0.7, "unzoom": 0.3, "reflection": 0.4, "floating": 3.0 }
  },
  pageCurl: {
    "glsl" : "#ifdef GL_ES\nprecision highp float;\n#endif\nuniform sampler2D from, to;\nuniform float progress;\nuniform vec2 resolution;\n\n// Adapted by Sergey Kosarevsky from:\n// http://rectalogic.github.io/webvfx/examples_2transition-shader-pagecurl_8html-example.html\n\n/*\nCopyright (c) 2010 Hewlett-Packard Development Company, L.P. All rights reserved.\n\nRedistribution and use in source and binary forms, with or without\nmodification, are permitted provided that the following conditions are\nmet:\n\n   * Redistributions of source code must retain the above copyright\n     notice, this list of conditions and the following disclaimer.\n   * Redistributions in binary form must reproduce the above\n     copyright notice, this list of conditions and the following disclaimer\n     in the documentation and/or other materials provided with the\n     distribution.\n   * Neither the name of Hewlett-Packard nor the names of its\n     contributors may be used to endorse or promote products derived from\n     this software without specific prior written permission.\n\nTHIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS\n\"AS IS\" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT\nLIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR\nA PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT\nOWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,\nSPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT\nLIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,\nDATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY\nTHEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT\n(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE\nOF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.\nin vec2 texCoord;\n*/\n\nconst float MIN_AMOUNT = -0.16;\nconst float MAX_AMOUNT = 1.3;\nfloat amount = progress * (MAX_AMOUNT - MIN_AMOUNT) + MIN_AMOUNT;\n\nconst float PI = 3.141592653589793;\n\nconst float scale = 512.0;\nconst float sharpness = 3.0;\n\nfloat cylinderCenter = amount;\n// 360 degrees * amount\nfloat cylinderAngle = 2.0 * PI * amount;\n\nconst float cylinderRadius = 1.0 / PI / 2.0;\n\nvec3 hitPoint(float hitAngle, float yc, vec3 point, mat3 rrotation)\n{\n\tfloat hitPoint = hitAngle / (2.0 * PI);\n\tpoint.y = hitPoint;\n\treturn rrotation * point;\n}\n\nvec4 antiAlias(vec4 color1, vec4 color2, float distanc)\n{\n\tdistanc *= scale;\n\tif (distanc < 0.0) return color2;\n\tif (distanc > 2.0) return color1;\n\tfloat dd = pow(1.0 - distanc / 2.0, sharpness);\n\treturn ((color2 - color1) * dd) + color1;\n}\n\nfloat distanceToEdge(vec3 point)\n{\n\tfloat dx = abs(point.x > 0.5 ? 1.0 - point.x : point.x);\n\tfloat dy = abs(point.y > 0.5 ? 1.0 - point.y : point.y);\n\tif (point.x < 0.0) dx = -point.x;\n\tif (point.x > 1.0) dx = point.x - 1.0;\n\tif (point.y < 0.0) dy = -point.y;\n\tif (point.y > 1.0) dy = point.y - 1.0;\n\tif ((point.x < 0.0 || point.x > 1.0) && (point.y < 0.0 || point.y > 1.0)) return sqrt(dx * dx + dy * dy);\n\treturn min(dx, dy);\n}\n\nvec4 seeThrough(float yc, vec2 p, mat3 rotation, mat3 rrotation)\n{\n\tfloat hitAngle = PI - (acos(yc / cylinderRadius) - cylinderAngle);\n\tvec3 point = hitPoint(hitAngle, yc, rotation * vec3(p, 1.0), rrotation);\n\tif (yc <= 0.0 && (point.x < 0.0 || point.y < 0.0 || point.x > 1.0 || point.y > 1.0))\n\t{\n\t  vec2 texCoord = gl_FragCoord.xy / resolution.xy;\n\t\treturn texture2D(to, texCoord);\n\t}\n\n\tif (yc > 0.0) return texture2D(from, p);\n\n\tvec4 color = texture2D(from, point.xy);\n\tvec4 tcolor = vec4(0.0);\n\n\treturn antiAlias(color, tcolor, distanceToEdge(point));\n}\n\nvec4 seeThroughWithShadow(float yc, vec2 p, vec3 point, mat3 rotation, mat3 rrotation)\n{\n\tfloat shadow = distanceToEdge(point) * 30.0;\n\tshadow = (1.0 - shadow) / 3.0;\n\n\tif (shadow < 0.0) shadow = 0.0; else shadow *= amount;\n\n\tvec4 shadowColor = seeThrough(yc, p, rotation, rrotation);\n\tshadowColor.r -= shadow;\n\tshadowColor.g -= shadow;\n\tshadowColor.b -= shadow;\n\n\treturn shadowColor;\n}\n\nvec4 backside(float yc, vec3 point)\n{\n\tvec4 color = texture2D(from, point.xy);\n\tfloat gray = (color.r + color.b + color.g) / 15.0;\n\tgray += (8.0 / 10.0) * (pow(1.0 - abs(yc / cylinderRadius), 2.0 / 10.0) / 2.0 + (5.0 / 10.0));\n\tcolor.rgb = vec3(gray);\n\treturn color;\n}\n\nvec4 behindSurface(float yc, vec3 point, mat3 rrotation)\n{\n\tfloat shado = (1.0 - ((-cylinderRadius - yc) / amount * 7.0)) / 6.0;\n\tshado *= 1.0 - abs(point.x - 0.5);\n\n\tyc = (-cylinderRadius - cylinderRadius - yc);\n\n\tfloat hitAngle = (acos(yc / cylinderRadius) + cylinderAngle) - PI;\n\tpoint = hitPoint(hitAngle, yc, point, rrotation);\n\n\tif (yc < 0.0 && point.x >= 0.0 && point.y >= 0.0 && point.x <= 1.0 && point.y <= 1.0 && (hitAngle < PI || amount > 0.5))\n\t{\n\t\tshado = 1.0 - (sqrt(pow(point.x - 0.5, 2.0) + pow(point.y - 0.5, 2.0)) / (71.0 / 100.0));\n\t\tshado *= pow(-yc / cylinderRadius, 3.0);\n\t\tshado *= 0.5;\n\t}\n\telse\n\t{\n\t\tshado = 0.0;\n\t}\n\t\n\tvec2 texCoord = gl_FragCoord.xy / resolution.xy;\n\n\treturn vec4(texture2D(to, texCoord).rgb - shado, 1.0);\n}\n\nvoid main()\n{\n  vec2 texCoord = gl_FragCoord.xy / resolution.xy;\n  \n  const float angle = 30.0 * PI / 180.0;\n\tfloat c = cos(-angle);\n\tfloat s = sin(-angle);\n\n\tmat3 rotation = mat3( c, s, 0,\n\t\t\t\t\t\t\t\t-s, c, 0,\n\t\t\t\t\t\t\t\t0.12, 0.258, 1\n\t\t\t\t\t\t\t\t);\n\tc = cos(angle);\n\ts = sin(angle);\n\n\tmat3 rrotation = mat3(\tc, s, 0,\n\t\t\t\t\t\t\t\t\t-s, c, 0,\n\t\t\t\t\t\t\t\t\t0.15, -0.5, 1\n\t\t\t\t\t\t\t\t);\n\n\tvec3 point = rotation * vec3(texCoord, 1.0);\n\n\tfloat yc = point.y - cylinderCenter;\n\n\tif (yc < -cylinderRadius)\n\t{\n\t\t// Behind surface\n\t\tgl_FragColor = behindSurface(yc, point, rrotation);\n\t\treturn;\n\t}\n\n\tif (yc > cylinderRadius)\n\t{\n\t\t// Flat surface\n\t\tgl_FragColor = texture2D(from, texCoord);\n\t\treturn;\n\t}\n\n\tfloat hitAngle = (acos(yc / cylinderRadius) + cylinderAngle) - PI;\n\n\tfloat hitAngleMod = mod(hitAngle, 2.0 * PI);\n\tif ((hitAngleMod > PI && amount < 0.5) || (hitAngleMod > PI/2.0 && amount < 0.0))\n\t{\n\t\tgl_FragColor = seeThrough(yc, texCoord, rotation, rrotation);\n\t\treturn;\n\t}\n\n\tpoint = hitPoint(hitAngle, yc, point, rrotation);\n\n\tif (point.x < 0.0 || point.y < 0.0 || point.x > 1.0 || point.y > 1.0)\n\t{\n\t\tgl_FragColor = seeThroughWithShadow(yc, texCoord, point, rotation, rrotation);\n\t\treturn;\n\t}\n\n\tvec4 color = backside(yc, point);\n\n\tvec4 otherColor;\n\tif (yc < 0.0)\n\t{\n\t\tfloat shado = 1.0 - (sqrt(pow(point.x - 0.5, 2.0) + pow(point.y - 0.5, 2.0)) / 0.71);\n\t\tshado *= pow(-yc / cylinderRadius, 3.0);\n\t\tshado *= 0.5;\n\t\totherColor = vec4(0.0, 0.0, 0.0, shado);\n\t}\n\telse\n\t{\n\t\totherColor = texture2D(from, texCoord);\n\t}\n\n\tcolor = antiAlias(color, otherColor, cylinderRadius - abs(yc));\n\n\tvec4 cl = seeThroughWithShadow(yc, texCoord, point, rotation, rrotation);\n\tfloat dist = distanceToEdge(point);\n\n\tgl_FragColor = antiAlias(color, cl, dist);\n}",
  "uniforms": { "persp": 0.7, "unzoom": 0.3, "reflection": 0.4, "floating": 3.0 }
  },
  flyEye: {
    "glsl" : "#ifdef GL_ES\nprecision highp float;\n#endif\n \n// General parameters\nuniform sampler2D from;\nuniform sampler2D to;\nuniform float progress;\nuniform vec2 resolution;\n \n// Custom parameters\nuniform float size;\nuniform float zoom;\nuniform float colorSeparation;\n \nvoid main() {\n  vec2 p = gl_FragCoord.xy / resolution.xy;\n  float inv = 1. - progress;\n  vec2 disp = size*vec2(cos(zoom*p.x), sin(zoom*p.y));\n  vec4 texTo = texture2D(to, p + inv*disp);\n  vec4 texFrom = vec4(\n    texture2D(from, p + progress*disp*(1.0 - colorSeparation)).r,\n    texture2D(from, p + progress*disp).g,\n    texture2D(from, p + progress*disp*(1.0 + colorSeparation)).b,\n    1.0);\n  gl_FragColor = texTo*progress + texFrom*inv;\n}",
    "uniforms" : {
      "size" : 0.04,
      "zoom" : 30.0,
      "colorSeparation" : 0.3
    }
  },
  undulating: {
    "glsl" : "#ifdef GL_ES\nprecision highp float;\n#endif\n\n#define \tM_PI   3.14159265358979323846\t/* pi */\n\n// General parameters\nuniform sampler2D from;\nuniform sampler2D to;\nuniform float progress;\nuniform vec2 resolution;\n \nuniform float smoothness;\nconst vec2 center = vec2(0.5, 0.5);\n\nfloat quadraticInOut(float t) {\n  float p = 2.0 * t * t;\n  return t < 0.5 ? p : -p + (4.0 * t) - 1.0;\n}\n\nfloat linearInterp(vec2 range, vec2 domain, float x) {\n  return mix(range.x, range.y, smoothstep(domain.x, domain.y, clamp(x, domain.x, domain.y)));\n}\n\nfloat getGradient(float r, float dist) {\n  float grad = smoothstep(-smoothness, 0.0, r - dist * (1.0 + smoothness)); //, 0.0, 1.0);\n  if (r - dist < 0.005 && r - dist > -0.005) {\n    return -1.0;\n  } else if (r - dist < 0.01 && r - dist > -0.005) {\n   return -2.0;\n  }\n  return grad;\n}\n\nfloat round(float a) {\n  return floor(a + 0.5);\n}\n\nfloat getWave(vec2 p){\n  \n  // I'd really like to figure out how to make the ends meet on my circle.\n  // The left side is where the ends don't meet.\n  \n  vec2 _p = p - center; // offset from center\n  float rads = atan(_p.y, _p.x);\n  float degs = degrees(rads) + 180.0;\n  vec2 range = vec2(0.0, M_PI * 30.0);\n  vec2 domain = vec2(0.0, 360.0);\n  \n  float ratio = (M_PI * 30.0) / 360.0;\n  //degs = linearInterp(range, domain, degs);\n  degs = degs * ratio;\n  float x = progress;\n  float magnitude = mix(0.02, 0.09, smoothstep(0.0, 1.0, x));\n  float offset = mix(40.0, 30.0, smoothstep(0.0, 1.0, x));\n  float ease_degs = quadraticInOut(sin(degs));\n  \n  float deg_wave_pos = (ease_degs * magnitude) * sin(x * offset);\n  return x + deg_wave_pos;\n}\n\nvoid main() {\n  vec2 p = gl_FragCoord.xy / resolution.xy;\n  \n  if (progress == 0.0) {\n    gl_FragColor = texture2D(from, p);\n  } else if (progress == 1.0) {\n    gl_FragColor = texture2D(to, p);\n  } else {\n    float dist = distance(center, p);\n    float m = getGradient(getWave(p), dist);\n    if (m == -2.0) {\n      //gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);\n      //gl_FragColor = mix(texture2D(from, p), texture2D(to, p), -1.0);\n      gl_FragColor = mix(texture2D(from, p), vec4(0.0, 0.0, 0.0, 1.0), 0.75);\n    } else {\n      gl_FragColor = mix(texture2D(from, p), texture2D(to, p), m);    \n    }\n  }\n  \n}",
    "uniforms" : {
      "smoothness" : 0.02
    }
  },
  doomScreen: {
    "glsl" : "#ifdef GL_ES\nprecision highp float;\n#endif\n\n\n// Hardcoded parameters --------\n\nuniform sampler2D from, to;\nuniform float progress;\nuniform vec2 resolution;\n\n\n// Transition parameters --------\n\n// default barWidth = 10\nuniform int barWidth; // Number of bars\n\n// default amplitude = 2\nuniform float amplitude; // 0 = no variation when going down, higher = some elements go much faster\n\n// default noise = 0.1\nuniform float noise; // 0 = no noise, 1 = super noisy\n\n// default frequency = 1\nuniform float frequency; // the bigger the value, the shorter the waves\n\n// The code proper --------\n\nfloat rand(int num) {\n  return fract(mod(float(num) * 67123.313, 12.0) * sin(float(num) * 10.3) * cos(float(num)));\n}\n\nfloat wave(int num) {\n  float fn = float(num) * frequency * 0.1  * float(barWidth);\n  return cos(fn * 0.5) * cos(fn * 0.13) * sin((fn+10.0) * 0.3) / 2.0 + 0.5;\n}\n\nfloat pos(int num) {\n  return noise == 0.0 ? wave(num) : mix(wave(num), rand(num), noise);\n}\n\nvoid main() {\n  int bar = int(gl_FragCoord.x) / barWidth;\n  float scale = 1.0 + pos(bar) * amplitude;\n  float phase = progress * scale;\n  float posY = gl_FragCoord.y / resolution.y;\n  vec2 p;\n  vec4 c;\n  if (phase + posY < 1.0) {\n    p = vec2(gl_FragCoord.x, gl_FragCoord.y + mix(0.0, resolution.y, phase)) / resolution.xy;\n    c = texture2D(from, p);\n  } else {\n    p = gl_FragCoord.xy / resolution.xy;\n    c = texture2D(to, p);\n  }\n\n  // Finally, apply the color\n  gl_FragColor = c;\n}\n",
    "uniforms" : {
      "barWidth" : 10.0,
      "noise" : 0.2,
      "amplitude" : 2.0,
      "frequency" : 1.0
    }
  },
  glitch: {
    "glsl" : "#ifdef GL_ES\nprecision highp float;\n#endif\nuniform sampler2D from, to;\nuniform float progress;\nuniform vec2 resolution;\nhighp float random(vec2 co)\n{\n    highp float a = 12.9898;\n    highp float b = 78.233;\n    highp float c = 43758.5453;\n    highp float dt= dot(co.xy ,vec2(a,b));\n    highp float sn= mod(dt,3.14);\n    return fract(sin(sn) * c);\n}\nfloat voronoi( in vec2 x ) {\n    vec2 p = floor( x );\n    vec2 f = fract( x );\n    float res = 8.0;\n    for( float j=-1.; j<=1.; j++ )\n    for( float i=-1.; i<=1.; i++ ) {\n        vec2  b = vec2( i, j );\n        vec2  r = b - f + random( p + b );\n        float d = dot( r, r );\n        res = min( res, d );\n    }\n    return sqrt( res );\n}\n\nvec2 displace(vec4 tex, vec2 texCoord, float dotDepth, float textureDepth, float strength) {\n    float b = voronoi(.003 * texCoord + 2.0);\n    float g = voronoi(0.2 * texCoord);\n    float r = voronoi(texCoord - 1.0);\n    vec4 dt = tex * 1.0;\n    vec4 dis = dt * dotDepth + 1.0 - tex * textureDepth;\n\n    dis.x = dis.x - 1.0 + textureDepth*dotDepth;\n    dis.y = dis.y - 1.0 + textureDepth*dotDepth;\n    dis.x *= strength;\n    dis.y *= strength;\n    vec2 res_uv = texCoord ;\n    res_uv.x = res_uv.x + dis.x - 0.0;\n    res_uv.y = res_uv.y + dis.y;\n    return res_uv;\n}\n\nfloat ease1(float t) {\n  return t == 0.0 || t == 1.0\n    ? t\n    : t < 0.5\n      ? +0.5 * pow(2.0, (20.0 * t) - 10.0)\n      : -0.5 * pow(2.0, 10.0 - (t * 20.0)) + 1.0;\n}\nfloat ease2(float t) {\n  return t == 1.0 ? t : 1.0 - pow(2.0, -10.0 * t);\n}\n\n\n\nvoid main() {\n  vec2 p = gl_FragCoord.xy / resolution.xy;\n  vec4 color1 = texture2D(from, p);\n  vec4 color2 = texture2D(to, p);\n  vec2 disp = displace(color1, p, 0.33, 0.7, 1.0-ease1(progress));\n  vec2 disp2 = displace(color2, p, 0.33, 0.5, ease2(progress));\n  vec4 dColor1 = texture2D(to, disp);\n  vec4 dColor2 = texture2D(from, disp2);\n  float val = ease1(progress);\n  vec3 gray = vec3(dot(min(dColor2, dColor1).rgb, vec3(0.299, 0.587, 0.114)));\n  dColor2 = vec4(gray, 1.0);\n  dColor2 *= 2.0;\n  color1 = mix(color1, dColor2, smoothstep(0.0, 0.5, progress));\n  color2 = mix(color2, dColor1, smoothstep(1.0, 0.5, progress));\n  gl_FragColor = mix(color1, color2, val);\n  //gl_FragColor = mix(gl_FragColor, dColor, smoothstep(0.0, 0.5, progress));\n  \n   //gl_FragColor = mix(texture2D(from, p), texture2D(to, p), progress);\n}",
    "uniforms" : { },
  }
};

export default function funFade() {
  stop(this.oldElement);
  var canvas = createCanvas(this.oldElement, this.newElement);
  var styleOptions = styleOptionsFromCanvas(canvas);

  var convertOldElementToImage = D2I.toPng(this.oldElement[0], styleOptions).then((dataUrl) => {
    this.oldElement.css({visibility: 'hidden'});
    return imageFromDataUrl(dataUrl);
  }).catch(function (error) {
    console.error('Error converting the old element to an image.', error);
  });

  var convertNewElementToImage = D2I.toPng(this.newElement[0], styleOptions).then((dataUrl) => {
    this.newElement.css({visibility: 'hidden'});
    return imageFromDataUrl(dataUrl);
  }).catch(function (error) {
    console.error('Error converting the new element to an image.', error);
  });

  return RSVP.hash({
    fromImage: convertOldElementToImage,
    toImage: convertNewElementToImage
  }).then(function(hash) {
    return animateTransition(canvas, TRANSITIONS.cube, hash.fromImage, hash.toImage);
  }).then(() => {
    showNewElement(this.newElement);
  });
}

function styleOptionsFromCanvas(canvas) {
  return {
    height: canvas.height,
    width: canvas.width,

    style: {
      visibility: 'visible'
    }
  };
}

function showNewElement(newElement) {
  if (newElement) {
    newElement.css({visibility: 'visible'});
  }
}

function createCanvas($oldElement, $newElement) {
  var canvas = document.createElement('canvas');
  var height = Math.max($oldElement.height(), $newElement.height());
  var width = Math.max($oldElement.width(), $newElement.width());
  canvas.style.display = 'block';
  canvas.style.position = 'absolute';
  canvas.style.top = $oldElement.offset().top + 'px';
  canvas.style.left = $oldElement.offset().left + 'px';
  canvas.width = width;
  canvas.height = height;

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

function animationLoop(transition, fromTexture, toTexture, uniforms, duration) {
  var start = null;

  return new Promise(function(resolve) {
    raf(function loop (timestamp) {
      var handle = raf(loop);
      if (!start) { start = timestamp; }
      var progress = ((timestamp - start) / duration) / 1.0;

      if (progress >= 1.0) {
        raf.cancel(handle);
        resolve();
      }

      transition.render(progress, fromTexture, toTexture, uniforms);
    });
  });
}

function animateTransition(canvas, transitionData, fromImage, toImage) {
  var gl = canvas.getContext('webgl');
  if (!gl) { console.error('Unable to get WebGL context.'); }
  configureGl(gl);

  var { from, to } = texturesFromImages(gl, fromImage, toImage);
  var transition = createTransition(gl, transitionData.glsl);

  document.body.appendChild(canvas);
  return animationLoop(transition, from, to, transitionData.uniforms, DURATION).then(function() {
      document.body.removeChild(canvas);
  });
}
