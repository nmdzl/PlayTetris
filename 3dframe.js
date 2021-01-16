/* GLOBAL CONSTANTS AND VARIABLES */

/* webgl and geometry data */
var gl_3dframe = null;
const vertices_3dframe = [];
// horizontal
for (var i = 0; i <= boardHeight; i++) {
    vertices_3dframe.push(
        i - boundary, -boundary, -boundary,
        i - boundary, boardLength + boundary, -boundary
    );
}
// vertical
for (var j = 0; j <= boardLength; j++) {
    vertices_3dframe.push(
        -boundary, j - boundary, -boundary,
        boardHeight + boundary, j - boundary, -boundary
    );
}

var verticesBuffer_3dframe;


function render_3dframe() {
    // setup webgl
    gl_3dframe = null;
    var canvas = document.getElementById("3dframe");
    gl_3dframe = canvas.getContext("webgl");

    // load
    verticesBuffer_3dframe = gl_3dframe.createBuffer();
    
    document.getElementById("test") = "boundary";
}