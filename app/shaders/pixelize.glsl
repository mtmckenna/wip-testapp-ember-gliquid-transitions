#ifdef GL_ES
precision highp float;
#endif
uniform sampler2D from, to;
uniform float progress;
uniform vec2 resolution;

float rand(vec2 cof){
  return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
}

void main() {
  float revProgress = (1.0 - progress);
  float distFromEdges = min(progress, revProgress);
  float squareSize = (50.0 * distFromEdges) + 1.0;

  vec2 p = (floor((gl_FragCoord.xy + squareSize * 0.5) / squareSize) * squareSize) / resolution.xy;
  vec4 fromColor = texture2D(from, p);
  vec4 toColor = texture2D(to, p);

  gl_FragColor = mix(fromColor, toColor, progress);
}
