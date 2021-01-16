/* GLOBAL CONSTANTS AND VARIABLES */
var dimension = 1;
var max_score = 0;
var max_level = 0;
var score;
var level;
var game_over;
var model = {};
var nxt_type;

/* board and grids */
const boundary = 0.45;
const boardLength = 10;
const boardHeight = 20;
var grids = new Array(boardHeight);

// definition of grid positions:
// center at upper left - (0, 0)
// edge length of each grid - 1
// o----> y
// |
// |
// |
// |
// V x

/* viewing globals */
var temph = boardHeight;
var templ = boardLength + 2 * boundary;
const eye = new vec3.fromValues(temph, (boardLength - 1)/2, boardHeight*2);
const up = new vec3.fromValues(-1, 0, 0);
var tempex = eye[0] + boundary * 3;
var tempex_ = temph - tempex;
var temp1 = Math.sqrt(tempex*tempex + eye[2]*eye[2]);
var temp2 = Math.sqrt(tempex_*tempex_ + eye[2]*eye[2]);
var temp3 = temph * temp1 / (temp1 + temp2) - tempex;
const dist = Math.sqrt(temp3*temp3 + eye[2]*eye[2]);
const at = new vec3.fromValues(temp3 / dist, 0, -eye[2] / dist);

const center = new vec3.fromValues(
    eye[0] + at[0] * dist,
    eye[1] + at[1] * dist,
    eye[2] + at[2] * dist
);

const lightPos = new vec3.fromValues(temph*1.5, (boardLength-1)/2.0, boardHeight * 2);

var pvMatrixUniform3d;
var projMatrix3d = mat4.create();
var viewMatrix3d = mat4.create();
var pvMatrix3d = mat4.create();
var angle = Math.atan((temph-eye[0])/eye[2]) + Math.atan(eye[0]/eye[2]);
mat4.perspective(projMatrix3d, angle*1.1, templ/temph, 0.1, 100.0);
mat4.lookAt(viewMatrix3d, eye, center, up);
mat4.multiply(pvMatrix3d, projMatrix3d, viewMatrix3d);

var pvMatrixUniform_firstPerson;
var projMatrix_firstPerson = mat4.create();
var viewMatrix_firstPerson = mat4.create();
var pvMatrix_firstPerson = mat4.create();
mat4.perspective(projMatrix_firstPerson, Math.PI/2, 1, 0.1, 10.0);


/* webgl globals */
var gl = null; // the all powerful gl object. It's all here folks!

// 2d

var trianglesArray2d = new Array(boardHeight);
var verticesArray2d = new Array(boardHeight);
var diffuseArray2d = new Array(boardHeight);
var alphaArray2d = new Array(boardHeight);

var triangleBuffer2d = new Array(boardHeight); // this contains indices into vertexBuffer in triples

var vertexBuffer2d = new Array(boardHeight); // this contains vertex coordinates in triples
var vertexPositionAttrib2d; // where to put position for vertex shader

var diffuseBuffer2d = new Array(boardHeight); // this contains diffuse in triples
var vertexDiffuseAttrib2d; // where to put diffuse for vertex shader

var alphaBuffer2d = new Array(boardHeight);
var vertexAlphaAttrib2d;

//3d

var trianglesArray3d = new Array(boardHeight);
var verticesArray3d = new Array(boardHeight);
var normalArray3d = new Array(boardHeight);
var diffuseArray3d = new Array(boardHeight);
var alphaArray3d = new Array(boardHeight);

var triangleBuffer3d = new Array(boardHeight); // this contains indices into vertexBuffer in triples

var vertexBuffer3d = new Array(boardHeight); // this contains vertex coordinates in triples
var vertexPositionAttrib3d; // where to put position for vertex shader

var normalBuffer3d = new Array(boardHeight);
var vertexNormalAttrib3d;

var diffuseBuffer3d = new Array(boardHeight); // this contains diffuse in triples
var vertexDiffuseAttrib3d; // where to put diffuse for vertex shader

var alphaBuffer3d = new Array(boardHeight);
var vertexAlphaAttrib3d;

var lightPositionULoc3d;
var eyePositionULoc3d;


/* Definition of colors and tetrominoes:
 * 0 - white    ----
 * 1 - red      _||^
 * 2 - orange   ^||_
 * 3 - yellow   |||
 * 4 - green    ||__
 * 5 - blue     __||
 * 6 - purple   _||_
 */
// const colors = [
//     [225, 225, 225], [228, 3, 3], [255, 140, 0],
//     [255, 237, 0], [0, 128, 38], [0, 77, 255], [117, 7, 135]
// ];
const colors = [
    [0.88235, 0.88235, 0.88235],
    [0.89412, 0.11765, 0.11765],
    [1, 0.54902, 0],
    [1, 0.92941, 0],
    [0, 0.50196, 0.14902],
    [0, 0.30196, 1],
    [0.45882, 0.02745, 0.52941]
];


// set up the webGL environment
function setupWebGL() {
    gl = null;

    // Get the canvas and context
    var canvas = document.getElementById("myWebGLCanvas"); // create a js canvas
    gl = canvas.getContext("webgl"); // get a webgl object from it
    
    try {
      if (gl == null) {
        throw "unable to create gl context -- is your browser gl ready?";
      } else {
        gl.clearColor(0.0, 0.0, 0.0, 0.0); // use black when we clear the frame buffer
        gl.clearDepth(1.0); // use max when we clear the depth buffer
        gl.enable(gl.DEPTH_TEST); // use hidden surface removal (with zbuffering)
      }
    } // end try
    
    catch(e) {
      console.log(e);
    } // end catch
 
} // end setupWebGL

// read triangles in, load them into webgl buffers
// 4------5
// |\     |\
// | 0------1
// 7-|----6 |
//  \|     \|
//   3------2
// 2d read-in follows order:
// {0, 1, 2, 3} - [0, 1, 2], [0, 3, 2]
// 3d read-in follows order:
// {0, 1, 2, 3} - [0, 1, 2], [0, 3, 2] -> [0, 1, 2], [0, 3, 2]
// {0, 4, 7, 3} - [0, 4, 7], [0, 3 ,7] -> [0, 1, 2], [0, 3, 2]
// {1, 2, 6, 5} - [1, 2, 6], [1, 5 ,6] -> [0, 1, 2], [0, 3, 2]
// {2, 3, 7, 6} - [2, 3, 7], [2, 6, 7] -> [0, 1, 2], [0, 3, 2]
function loadTriangles() {

    /* 2d */
    const width = boardLength / 2;
    const height = boardHeight / 2;
    const xalign = -(boardLength - 1) / 2;
    const yalign = (boardHeight - 1) / 2;

    for(var i = 0; i < boardHeight; i++) {
        verticesArray2d[i] = [];
        trianglesArray2d[i] = [];
        var offset = 0;
        for (var j = 0; j < boardLength; j++) {
            verticesArray2d[i].push(
                (xalign - boundary + j) / width, (yalign + boundary - i) / height, 0,
                (xalign + boundary + j) / width, (yalign + boundary - i) / height, 0,
                (xalign + boundary + j) / width, (yalign - boundary - i) / height, 0,
                (xalign - boundary + j) / width, (yalign - boundary - i) / height, 0
            );
            trianglesArray2d[i].push(offset, offset + 1, offset + 2, offset, offset + 3, offset + 2);
            offset += 4;
        }

        // send the vertex coords to webGL
        vertexBuffer2d[i] = gl.createBuffer(); // init empty vertex coord buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer2d[i]); // activate that buffer
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verticesArray2d[i]), gl.STATIC_DRAW); // coords to that buffer
    
        // send the triangle indices to webGL
        triangleBuffer2d[i] = gl.createBuffer(); // init empty triangle index buffer
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleBuffer2d[i]); // activate that buffer
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(trianglesArray2d[i]),gl.STATIC_DRAW); // indices to that buffer
    }

    /* 3d */

    for (var i = 0; i < boardHeight; i++) {
        verticesArray3d[i] = [];
        trianglesArray3d[i] = [];
        normalArray3d[i] = [];
        var offset = 0;
        for (var j = 0; j < boardLength; j++) {
            verticesArray3d[i].push(
                // {0, 1, 2, 3}
                i - boundary, j - boundary, boundary,
                i - boundary, j + boundary, boundary,
                i + boundary, j + boundary, boundary,
                i + boundary, j - boundary, boundary,
                // {0, 4, 7, 3}
                i - boundary, j - boundary, boundary,
                i - boundary, j - boundary, -boundary,
                i + boundary, j - boundary, -boundary,
                i + boundary, j - boundary, boundary,
                // {1, 2, 6, 5}
                i - boundary, j + boundary, boundary,
                i + boundary, j + boundary, boundary,
                i + boundary, j + boundary, -boundary,
                i - boundary, j + boundary, -boundary,
                // {2, 3, 7, 6}
                i + boundary, j + boundary, boundary,
                i + boundary, j - boundary, boundary,
                i + boundary, j - boundary, -boundary,
                i + boundary, j + boundary, -boundary
            );
            trianglesArray3d[i].push(offset, offset + 1, offset + 2, offset, offset + 3, offset + 2);
            offset += 4;
            trianglesArray3d[i].push(offset, offset + 1, offset + 2, offset, offset + 3, offset + 2);
            offset += 4;
            trianglesArray3d[i].push(offset, offset + 1, offset + 2, offset, offset + 3, offset + 2);
            offset += 4;
            trianglesArray3d[i].push(offset, offset + 1, offset + 2, offset, offset + 3, offset + 2);
            offset += 4;
            normalArray3d[i].push(0,0,1,0,0,1,0,0,1,0,0,1);
            normalArray3d[i].push(0,-1,0,0,-1,0,0,-1,0,0,-1,0);
            normalArray3d[i].push(0,1,0,0,1,0,0,1,0,0,1,0);
            normalArray3d[i].push(1,0,0,1,0,0,1,0,0,1,0,0);
        }

        // send the vertex coords to webGL
        vertexBuffer3d[i] = gl.createBuffer(); // init empty vertex coord buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer3d[i]); // activate that buffer
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verticesArray3d[i]), gl.STATIC_DRAW); // coords to that buffer

        normalBuffer3d[i] = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer3d[i]);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normalArray3d[i]), gl.STATIC_DRAW);
    
        // send the triangle indices to webGL
        triangleBuffer3d[i] = gl.createBuffer(); // init empty triangle index buffer
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleBuffer3d[i]); // activate that buffer
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(trianglesArray3d[i]),gl.STATIC_DRAW); // indices to that buffer
    }
} // end load triangles

function loadColorAndAlpha() {
    if (dimension == 2) {
        for (var i = 0; i < boardHeight; i++) {
            diffuseArray2d[i] = [];
            alphaArray2d[i] = [];
            for (var j = 0; j < boardLength; j++) {
                if (grids[i][j] != -1) {
                    for (var k = 0; k < 4; k++) {
                        diffuseArray2d[i].push(
                            colors[grids[i][j]][0],
                            colors[grids[i][j]][1],
                            colors[grids[i][j]][2]
                        );
                        alphaArray2d[i].push(1.0);
                    }
                } else {
                    for (var k = 0; k < 4; k++) {
                        diffuseArray2d[i].push(0, 0, 0);
                        alphaArray2d[i].push(0.0);
                    }
                }
            }

            diffuseBuffer2d[i] = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, diffuseBuffer2d[i]);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(diffuseArray2d[i]), gl.STATIC_DRAW);

            alphaBuffer2d[i] = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, alphaBuffer2d[i]);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(alphaArray2d[i]), gl.STATIC_DRAW);
        }
    } else {
        for (var i = 0; i < boardHeight; i++) {
            diffuseArray3d[i] = [];
            alphaArray3d[i] = [];
            for (var j = 0; j < boardLength; j++) {
                if (grids[i][j] != -1) {
                    for (var k = 0; k < 16; k++) {
                        diffuseArray3d[i].push(
                            colors[grids[i][j]][0],
                            colors[grids[i][j]][1],
                            colors[grids[i][j]][2]
                        );
                        alphaArray3d[i].push(1.0);
                    }
                } else {
                    for (var k = 0; k < 16; k++) {
                        diffuseArray3d[i].push(0, 0, 0);
                        alphaArray3d[i].push(0.0);
                    }
                }
            }

            diffuseBuffer3d[i] = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, diffuseBuffer3d[i]);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(diffuseArray3d[i]), gl.STATIC_DRAW);

            alphaBuffer3d[i] = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, alphaBuffer3d[i]);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(alphaArray3d[i]), gl.STATIC_DRAW);
        }
    }
}


// setup the webGL shaders
function setupShaders(set_dimension) {
    if (set_dimension == dimension) return;
    if (set_dimension == 0) {
        if (dimension == 1) set_dimension = 2;
        else set_dimension = dimension;
    }
    
    window["render_" + set_dimension + "dframe"]();
    
    var fShaderCode = `
        precision highp float;
        varying vec4 fragColor;

        void main(void) {
            gl_FragColor = fragColor;
        }
    `;
    
    var vShaderCode = (set_dimension == 2 ? `
        attribute vec3 vertexPosition;
        attribute vec3 diffuse;
        attribute float alpha;
        varying vec4 fragColor;

        void main(void) {
            gl_Position = vec4(vertexPosition, 1.0);
            fragColor = vec4(diffuse, alpha);
        }
    ` : `
        attribute vec3 vertexPosition;
        attribute vec3 diffuse;
        attribute vec3 normal;
        attribute float alpha;
        varying vec4 fragColor;

        uniform mat4 upvMatrix;

        uniform vec3 lightPos;
        uniform vec3 eyePos;
        
        void main(void) {
            gl_Position = upvMatrix * vec4(vertexPosition, 1.0);

            vec3 ambient = diffuse * 0.2;

            vec3 light = normalize(lightPos - vertexPosition);
            float lambert = max(0.0, dot(normal, light));
            vec3 diffuse = diffuse * lambert;

            vec3 eye = normalize(eyePos - vertexPosition);
            vec3 halfVec = normalize(light + eye);
            float highlight = pow(max(0.0, dot(normal, halfVec)), 7.0);
            vec3 specular = diffuse * 0.2 * highlight;

            fragColor = vec4(ambient + diffuse + specular, alpha);
        }
    `);
    
    try {
        // console.log("fragment shader: "+fShaderCode);
        var fShader = gl.createShader(gl.FRAGMENT_SHADER); // create frag shader
        gl.shaderSource(fShader,fShaderCode); // attach code to shader
        gl.compileShader(fShader); // compile the code for gpu execution

        // console.log("vertex shader: "+vShaderCode);
        var vShader = gl.createShader(gl.VERTEX_SHADER); // create vertex shader
        gl.shaderSource(vShader,vShaderCode); // attach code to shader
        gl.compileShader(vShader); // compile the code for gpu execution
            
        if (!gl.getShaderParameter(fShader, gl.COMPILE_STATUS)) { // bad frag shader compile
            throw "error during fragment shader compile: " + gl.getShaderInfoLog(fShader);  
            gl.deleteShader(fShader);
        } else if (!gl.getShaderParameter(vShader, gl.COMPILE_STATUS)) { // bad vertex shader compile
            throw "error during vertex shader compile: " + gl.getShaderInfoLog(vShader);  
            gl.deleteShader(vShader);
        } else { // no compile errors
            var shaderProgram = gl.createProgram(); // create the single shader program
            gl.attachShader(shaderProgram, fShader); // put frag shader in program
            gl.attachShader(shaderProgram, vShader); // put vertex shader in program
            gl.linkProgram(shaderProgram); // link program into gl context

            if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) { // bad program link
                throw "error during shader program linking: " + gl.getProgramInfoLog(shaderProgram);
            } else { // no shader program link errors
                gl.useProgram(shaderProgram); // activate shader program (frag and vert)

                if (set_dimension == 2) {
                    vertexPositionAttrib2d = gl.getAttribLocation(shaderProgram, "vertexPosition"); 
                    gl.enableVertexAttribArray(vertexPositionAttrib2d);

                    vertexDiffuseAttrib2d = gl.getAttribLocation(shaderProgram, "diffuse");
                    gl.enableVertexAttribArray(vertexDiffuseAttrib2d);

                    vertexAlphaAttrib2d = gl.getAttribLocation(shaderProgram, "alpha");
                    gl.enableVertexAttribArray(vertexAlphaAttrib2d);

                } else {
                    vertexPositionAttrib3d = gl.getAttribLocation(shaderProgram, "vertexPosition"); 
                    gl.enableVertexAttribArray(vertexPositionAttrib3d);
                
                    vertexNormalAttrib3d = gl.getAttribLocation(shaderProgram, "normal");
                    gl.enableVertexAttribArray(vertexNormalAttrib3d);

                    vertexDiffuseAttrib3d = gl.getAttribLocation(shaderProgram, "diffuse");
                    gl.enableVertexAttribArray(vertexDiffuseAttrib3d);

                    vertexAlphaAttrib3d = gl.getAttribLocation(shaderProgram, "alpha");
                    gl.enableVertexAttribArray(vertexAlphaAttrib3d);

                    // light and eye positions
                    lightPositionULoc3d = gl.getUniformLocation(shaderProgram, "lightPos");
                    gl.uniform3fv(lightPositionULoc3d, lightPos);

                    eyePositionULoc3d = gl.getUniformLocation(shaderProgram, "eyePos");
                    gl.uniform3fv(eyePositionULoc3d, eye);

                    // viewing matrix
                    pvMatrixUniform3d = gl.getUniformLocation(shaderProgram, "upvMatrix");
                }
            } // end if no shader program link errors
        } // end if no compile errors
    } // end try 
    
    catch(e) {
        console.log(e);
    } // end catch

    dimension = set_dimension;
} // end setup shaders


function renderTriangles() {

    loadColorAndAlpha();

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); // clear frame/depth buffers
    
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.BLEND);

    if (dimension == 2) {

        for (var i = 0; i < boardHeight; i++) {
            gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer2d[i]);
            gl.vertexAttribPointer(vertexPositionAttrib2d, 3, gl.FLOAT, false, 0, 0);

            gl.bindBuffer(gl.ARRAY_BUFFER, diffuseBuffer2d[i]);
            gl.vertexAttribPointer(vertexDiffuseAttrib2d, 3, gl.FLOAT, false, 0, 0);

            gl.bindBuffer(gl.ARRAY_BUFFER, alphaBuffer2d[i]);
            gl.vertexAttribPointer(vertexAlphaAttrib2d, 1, gl.FLOAT, false, 0, 0);

            // triangle buffer: activate and render
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleBuffer2d[i]); // activate
            gl.drawElements(gl.TRIANGLES, 6*boardLength, gl.UNSIGNED_SHORT, 0); // render
        }
    } else {
        gl.uniformMatrix4fv(pvMatrixUniform3d, gl.FALSE, pvMatrix3d);

        for (var i = 0; i < boardHeight; i++) {
            gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer3d[i]);
            gl.vertexAttribPointer(vertexPositionAttrib3d, 3, gl.FLOAT, false, 0, 0);
        
            gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer3d[i]);
            gl.vertexAttribPointer(vertexNormalAttrib3d, 3, gl.FLOAT, false, 0, 0);

            gl.bindBuffer(gl.ARRAY_BUFFER, diffuseBuffer3d[i]);
            gl.vertexAttribPointer(vertexDiffuseAttrib3d, 3, gl.FLOAT, false, 0, 0);

            gl.bindBuffer(gl.ARRAY_BUFFER, alphaBuffer3d[i]);
            gl.vertexAttribPointer(vertexAlphaAttrib3d, 1, gl.FLOAT, false, 0, 0);

            // triangle buffer: activate and render
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleBuffer3d[i]); // activate
            gl.drawElements(gl.TRIANGLES, 24*boardLength, gl.UNSIGNED_SHORT, 0); // render
        }
    }
    renderFirstPerson();
} // end render triangles


/* game utilites */

/* Definition of colors and tetrominoes:
 * 0 - white    ----
 * 1 - red      _||^
 * 2 - orange   ^||_
 * 3 - yellow   |||
 * 4 - green    ||__
 * 5 - blue     __||
 * 6 - purple   _||_
 */
const initCenters = [
    [[0, 4], [0, 3], [0, 5], [0, 6]],
    [[1, 5], [1, 4], [0, 5], [0, 6]],
    [[1, 5], [0, 4], [0, 5], [1, 6]],
    [[0, 4], [0, 5], [1, 4], [1, 5]],
    [[1, 5], [1, 4], [0, 4], [1, 6]],
    [[1, 5], [1, 4], [0, 6], [1, 6]],
    [[1, 5], [0, 5], [1, 4], [1, 6]]
];
function build() {
    // check availability
    feasible = [];
    for (var type = 0; type < 7; type++) {
        var cur_centers = initCenters[type];
        var flag = true;
        for (var i = 0; i < 4; i++) {
            if (grids[cur_centers[i][0]][cur_centers[i][1]] != -1) {
                flag = false;
                break;
            }
        }
        if (flag) feasible.push(type);
    }
    if (feasible.length == 0) return false;

    score += 1;
    // select and update
    var flag = false;
    for (var i = 0; i < feasible.length; i++) {
        if (feasible[i] == nxt_type) {
            flag = true;
            break;
        }
    }
    var type;
    if (flag) {
        type = nxt_type;
    } else {
        type = feasible[Math.floor(Math.random() * feasible.length)];
    }
    nxt_type = Math.floor(Math.random() * 7);
    var cur_centers = initCenters[type];
    for (var i = 0; i < 4; i++) {
        grids[cur_centers[i][0]][cur_centers[i][1]] = type;
    }
    model.type = type;
    model.index = 0;
    model.center = [cur_centers[0][0], cur_centers[0][1]];
    model.eye = [model.center[0] + boundary, model.center[1]];
    if (type == 3) model.eye[0] += 1;

    updateScore();
    render_nextObject();
    return true;
}

const rotateCenters = {
    0: [[[0, -1], [0, 1], [0, 2]], [[-1, 0], [1, 0], [2, 0]]],
    1: [[[0, -1], [-1, 0], [-1, 1]], [[-1, 0], [0, 1], [1, 1]]],
    2: [[[0, 1], [-1, 0], [-1, -1]], [[-1, 0], [0, -1], [1, -1]]],
    3: [[[0, 1], [1, 0], [1, 1]]],
    4: [[[-1, -1], [0, -1], [0, 1]], [[-1, 0], [-1, 1], [1, 0]], [[0, -1], [0, 1], [1, 1]], [[-1, 0], [1, 0], [1, -1]]],
    5: [[[-1, 1], [0, -1], [0, 1]], [[-1, 0], [1, 0], [1, 1]], [[0, -1], [0, 1], [1, -1]], [[-1, 0], [1, 0], [-1, -1]]],
    6: [[[0, -1], [0, 1], [-1, 0]], [[-1, 0], [1, 0], [0, 1]], [[0, -1], [0, 1], [1, 0]], [[0, -1], [-1, 0], [1, 0]]]
};
const rotateChecklist = {
    0: [[[-1, 0], [1, 0], [2, 0]], [[0, -1], [0, 1], [0, 2]]],
    1: [[[0, 1], [1, 1]], [[0, -1], [-1, 1]]],
    2: [[[0, -1], [1, -1]], [[-1, -1], [0, 1]]],
    4: [[[-1, 0], [1, 0], [-1, 1]], [[0, -1], [0, 1], [1, 1]], [[-1, 0], [1, 0], [1, -1]], [[0, -1], [0, 1], [-1, -1]]],
    5: [[[-1, 0], [1, 0], [1, 1]], [[0, -1], [0, 1], [1, -1]], [[-1, 0], [1, 0], [-1, -1]], [[0, -1], [0, 1], [-1, 1]]],
    6: [[[1, 0]], [[0, -1]], [[-1, 0]], [[0, 1]]]
};
function rotate() {
    // check availablity
    if (model.type == 3) return;
    if (model.center[0] == boardHeight - 1) return;
    if (model.center[1] == boardLength - 1) return;
    if (model.type == 0) {
        if (model.index == 0 && model.center[0] == 0) return;
        if (model.index == 1 && (model.center[1] == 0 || model.center[1] == boardLength - 1 || model.center[1] == boardLength - 2)) return;
    }
    if (model.type == 1) {
        if (model.index == 1 && model.center[1] == 0) return;
    }
    if (model.type == 2) {
        if (model.index == 1 && model.center[1] == boardLength - 1) return;
    }
    if (model.type == 4 || model.type == 5) {
        if (model.index == 1 && model.center[1] == 0) return;
    }
    if (model.type == 6) {
        if (model.index == 1 && model.center[1] == 0) return;
    }
    var neiset_tocheck = rotateChecklist[model.type][model.index];
    for (var i = 0; i < neiset_tocheck.length; i++) {
        if (grids[neiset_tocheck[i][0] + model.center[0]][neiset_tocheck[i][1] + model.center[1]] != -1) return;
    }

    if (model.type == 0) {
        if (model.index == 0) model.eye[0] += 2;
        else model.eye[0] -= 2;
    } else if (model.type == 6) {
        if (model.index == 0) model.eye[0] += 1;
        if (model.index == 3) model.eye[1] -= 1;
    } else if (model.type > 3) {
        if (model.index == 0 || model.index == 2) model.eye[0] += 1;
        else model.eye[0] -= 1;
    }

    var cur_neiset = rotateCenters[model.type][model.index];
    model.index = (model.index + 1) % rotateCenters[model.type].length;
    var nxt_neiset = rotateCenters[model.type][model.index];
    // current
    grids[cur_neiset[0][0] + model.center[0]][cur_neiset[0][1] + model.center[1]] = -1;
    grids[cur_neiset[1][0] + model.center[0]][cur_neiset[1][1] + model.center[1]] = -1;
    grids[cur_neiset[2][0] + model.center[0]][cur_neiset[2][1] + model.center[1]] = -1;
    // next
    grids[nxt_neiset[0][0] + model.center[0]][nxt_neiset[0][1] + model.center[1]] = model.type;
    grids[nxt_neiset[1][0] + model.center[0]][nxt_neiset[1][1] + model.center[1]] = model.type;
    grids[nxt_neiset[2][0] + model.center[0]][nxt_neiset[2][1] + model.center[1]] = model.type;
}
const diveChecklist = {
    0: [[[1, -1], [1, 0], [1, 1], [1, 2]], [[3, 0]]],
    1: [[[1, 0], [1, -1], [0, 1]], [[1, 0], [2, 1]]],
    2: [[[1, 0], [0, -1], [1, 1]], [[1, 0], [2, -1]]],
    3: [[[2, 0], [2, 1]]],
    4: [[[1, -1], [1, 0], [1, 1]], [[2, 0], [0, 1]], [[1, -1], [1, 0], [2, 1]], [[2, -1], [2, 0]]],
    5: [[[1, -1], [1, 0], [1, 1]], [[2, 0], [2, 1]], [[2, -1], [1, 0], [1, 1]], [[0, -1], [2, 0]]],
    6: [[[1, -1], [1, 0], [1, 1]], [[2, 0], [1, 1]], [[1, -1], [2, 0], [1, 1]], [[1, -1], [2, 0]]]
}
function dive() {
    // check availablity
    if (model.center[0] == boardHeight - 1) return false;
    if (model.type == 0) {
        if (model.index == 1 && model.center[0] == boardHeight - 3) return false;
    }
    else if (model.type < 3) {
        if (model.index == 1 && model.center[0] == boardHeight - 2) return false;
    }
    else if (model.type == 3) {
        if (model.center[0] == boardHeight - 2) return false;
    }
    else {
        if (model.index > 0 && model.center[0] == boardHeight - 2) return false;
    }
    var neiset_tocheck = diveChecklist[model.type][model.index];
    for (var i = 0; i < neiset_tocheck.length; i++) {
        if (grids[neiset_tocheck[i][0] + model.center[0]][neiset_tocheck[i][1] + model.center[1]] != -1) return false;
    }

    var cur_neiset = rotateCenters[model.type][model.index];
    // current
    grids[model.center[0]][model.center[1]] = -1;
    grids[cur_neiset[0][0] + model.center[0]][cur_neiset[0][1] + model.center[1]] = -1;
    grids[cur_neiset[1][0] + model.center[0]][cur_neiset[1][1] + model.center[1]] = -1;
    grids[cur_neiset[2][0] + model.center[0]][cur_neiset[2][1] + model.center[1]] = -1;
    // next
    model.center[0] += 1;
    grids[model.center[0]][model.center[1]] = model.type;
    grids[cur_neiset[0][0] + model.center[0]][cur_neiset[0][1] + model.center[1]] = model.type;
    grids[cur_neiset[1][0] + model.center[0]][cur_neiset[1][1] + model.center[1]] = model.type;
    grids[cur_neiset[2][0] + model.center[0]][cur_neiset[2][1] + model.center[1]] = model.type;
    model.eye[0] += 1;

    eliminate();
    return true;
}
function land() {
    // check availablity
    if (model.center[0] == boardHeight - 1) return;
    if (model.type == 0) {
        if (model.index == 1 && model.center[0] == boardHeight - 3) return;
    }
    else if (model.type < 3) {
        if (model.index == 1 && model.center[0] == boardHeight - 2) return;
    }
    else if (model.type == 3) {
        if (model.center[0] == boardHeight - 2) return;
    }
    else {
        if (model.index > 0 && model.center[0] == boardHeight - 2) return;
    }
    var neiset_tocheck = diveChecklist[model.type][model.index];
    var distance = 0;
    var flag = true;
    while (flag) {
        if (model.center[0] + distance == boardHeight - 1) break;
        if (model.type == 0) {
            if (model.index == 1 && model.center[0] + distance == boardHeight - 3) break;
        }
        else if (model.type < 3) {
            if (model.index == 1 && model.center[0] + distance == boardHeight - 2) break;
        }
        else if (model.type == 3) {
            if (model.center[0] + distance == boardHeight - 2) break;
        }
        else {
            if (model.index > 0 && model.center[0] + distance == boardHeight - 2) break;
        }
        for (var i = 0; i < neiset_tocheck.length; i++) {
            if (grids[neiset_tocheck[i][0] + model.center[0] + distance][neiset_tocheck[i][1] + model.center[1]] != -1) {
                flag = false;
                break;
            }
        }
        if (flag) distance += 1;
    }
    if (distance == 0) return;

    var cur_neiset = rotateCenters[model.type][model.index];
    // current
    grids[model.center[0]][model.center[1]] = -1;
    grids[cur_neiset[0][0] + model.center[0]][cur_neiset[0][1] + model.center[1]] = -1;
    grids[cur_neiset[1][0] + model.center[0]][cur_neiset[1][1] + model.center[1]] = -1;
    grids[cur_neiset[2][0] + model.center[0]][cur_neiset[2][1] + model.center[1]] = -1;
    // next
    model.center[0] += distance;
    grids[model.center[0]][model.center[1]] = model.type;
    grids[cur_neiset[0][0] + model.center[0]][cur_neiset[0][1] + model.center[1]] = model.type;
    grids[cur_neiset[1][0] + model.center[0]][cur_neiset[1][1] + model.center[1]] = model.type;
    grids[cur_neiset[2][0] + model.center[0]][cur_neiset[2][1] + model.center[1]] = model.type;
    model.eye[0] += distance;

    eliminate();
}
const rightChecklist = {
    0: [[[0, 3]], [[-1, 1], [0, 1], [1, 1], [2, 1]]],
    1: [[[-1, 2], [0, 1]], [[-1, 1], [0, 2], [1, 2]]],
    2: [[[-1, 1], [0, 2]], [[-1, 1], [0, 1], [1, 0]]],
    3: [[[0, 2], [1, 2]]],
    4: [[[-1, 0], [0, 2]], [[-1, 2], [0, 1], [1, 1]], [[0, 2], [1, 2]], [[-1, 1], [0, 1], [1, 1]]],
    5: [[[-1, 2], [0, 2]], [[-1, 1], [0, 1], [1, 2]], [[0, 2], [1, 0]], [[-1, 1], [0, 1], [1, 1]]],
    6: [[[-1, 1], [0, 2]], [[-1, 1], [0, 2], [1, 1]], [[0, 2], [1, 1]], [[-1, 1], [0, 1], [1, 1]]]
}
function right() {
    // check availability
    if (model.center == boardLength - 1) return;
    if (model.type == 0) {
        if (model.index == 0 && model.center[1] == boardLength - 3) return;
    }
    if (model.type == 1 || model.type == 3) {
        if (model.center[1] == boardLength - 2) return;
    }
    if (model.type == 2 && model.index == 0) {
        if (model.center[1] == boardLength - 2) return;
    }
    if (model.type > 3) {
        if (model.index < 3 && model.center[1] == boardLength - 2) return;
    }
    var neiset_tocheck = rightChecklist[model.type][model.index];
    for (var i = 0; i < neiset_tocheck.length; i++) {
        if (grids[neiset_tocheck[i][0] + model.center[0]][neiset_tocheck[i][1] + model.center[1]] != -1) return;
    }

    var cur_neiset = rotateCenters[model.type][model.index];
    // current
    grids[model.center[0]][model.center[1]] = -1;
    grids[cur_neiset[0][0] + model.center[0]][cur_neiset[0][1] + model.center[1]] = -1;
    grids[cur_neiset[1][0] + model.center[0]][cur_neiset[1][1] + model.center[1]] = -1;
    grids[cur_neiset[2][0] + model.center[0]][cur_neiset[2][1] + model.center[1]] = -1;
    // next
    model.center[1] += 1;
    grids[model.center[0]][model.center[1]] = model.type;
    grids[cur_neiset[0][0] + model.center[0]][cur_neiset[0][1] + model.center[1]] = model.type;
    grids[cur_neiset[1][0] + model.center[0]][cur_neiset[1][1] + model.center[1]] = model.type;
    grids[cur_neiset[2][0] + model.center[0]][cur_neiset[2][1] + model.center[1]] = model.type;
    model.eye[1] += 1;
}
const leftChecklist = {
    0: [[[0, -2]], [[-1, -1], [0, -1], [1, -1], [2, -1]]],
    1: [[[-1, -1], [0, -2]], [[-1, -1], [0, -1], [1, 0]]],
    2: [[[-1, -2], [0, -1]], [[-1, -1], [0, -2], [1, -2]]],
    3: [[[0, -1], [1, -1]]],
    4: [[[-1, -2], [0, -2]], [[-1, -1], [0, -1], [1, -1]], [[0, -2], [1, 0]], [[-1, -1], [0, -1], [1, -2]]],
    5: [[[-1, 0], [0, -2]], [[-1, -1], [0, -1], [1, -1]], [[0, -2], [1, -2]], [[-1, -2], [0, -1], [1, -1]]],
    6: [[[-1, -1], [0, -2]], [[-1, -1], [0, -1], [1, -1]], [[0, -2], [1, -1]], [[-1, -1], [0, -2], [1, -1]]]
}
function left() {
    // check availabililty
    if (model.center == 0) return;
    if (model.type < 2) {
        if (model.index == 0 && model.center[1] == 1) return;
    }
    if (model.type == 2) {
        if (model.center[1] == 1) return;
    }
    if (model.type > 3) {
        if (model.index != 1 && model.center[1] == 1) return;
    }
    var neiset_tocheck = leftChecklist[model.type][model.index];
    for (var i = 0; i < neiset_tocheck.length; i++) {
        if (grids[neiset_tocheck[i][0] + model.center[0]][neiset_tocheck[i][1] + model.center[1]] != -1) return;
    }

    var cur_neiset = rotateCenters[model.type][model.index];
    // current
    grids[model.center[0]][model.center[1]] = -1;
    grids[cur_neiset[0][0] + model.center[0]][cur_neiset[0][1] + model.center[1]] = -1;
    grids[cur_neiset[1][0] + model.center[0]][cur_neiset[1][1] + model.center[1]] = -1;
    grids[cur_neiset[2][0] + model.center[0]][cur_neiset[2][1] + model.center[1]] = -1;
    // next
    model.center[1] -= 1;
    grids[model.center[0]][model.center[1]] = model.type;
    grids[cur_neiset[0][0] + model.center[0]][cur_neiset[0][1] + model.center[1]] = model.type;
    grids[cur_neiset[1][0] + model.center[0]][cur_neiset[1][1] + model.center[1]] = model.type;
    grids[cur_neiset[2][0] + model.center[0]][cur_neiset[2][1] + model.center[1]] = model.type;
    model.eye[1] -= 1;
}
function eliminate() {
    var full = [];
    for (var i = boardHeight - 1; i >= 0; i--) {
        var flag = true;
        for (var j = 0; j < boardLength; j++) {
            if (grids[i][j] == -1) {
                flag = false;
                break;
            }
        }
        if (flag) {
            full.push(i);
        }
    }
    if (full.length == 0) return;

    score += full.length * 10;
    level += full.length;

    var write = boardHeight - 1;
    var check = 0;
    var start = -1;
    for (var i = boardHeight - 1; i >= 0; i--) {
        if (i == full[check]) {
            check += 1;
            if (check == full.length) {
                start = i - 1;
                break;
            }
        } else {
            for (var j = 0; j < boardLength; j++) {
                grids[write][j] = grids[i][j];
            }
            write -= 1;
        }
    }
    for (; start >= 0; start--) {
        for (var j = 0; j < boardLength; j++) {
            grids[write][j] = grids[start][j];
        }
        write -= 1;
    }
    for (; write >= 0; write--) {
        for (var j = 0; j < boardLength; j++) {
            grids[write][j] = -1;
        }
    }
    updateScore();
    updateLevel();
}

function updateScore() {
    var scoreElement = document.getElementById("score");
    scoreElement.innerText = score;

    if (score > max_score) {
        max_score = score;
        var max_scoreElement = document.getElementById("max_score");
        max_scoreElement.innerText = max_score;
    }
}
function updateLevel() {
    var levelElement = document.getElementById("level");
    levelElement.innerText = level;

    if (level > max_level) {
        max_level = level;
        var max_levelElement = document.getElementById("max_level");
        max_levelElement.innerText = max_level;
    }
}

/* handle keyboard events */
function handleKeyDown(event) {
    switch (event.code) {
        case "ArrowRight":
        case "KeyD":
            right();
            break;
        case "ArrowLeft":
        case "KeyA":
            left();
            break;
        case "ArrowUp":
        case "KeyW":
            rotate();
            break;
        case "ArrowDown":
        case "KeyS":
            dive();
            break;
        case "Space":
            land();
            break;
    }
}


/* game */
/* the interval is defined by the following model:
 * y = a / (x + b)
 */
const intervalOriginal = 1.2 * 1000;
const intervalAt60Seconds = 0.4 * 1000;
const intervalRefresh = 0.1 * 1000;
var temp4 = 60000 / (intervalOriginal / intervalAt60Seconds - 1);
var temp5 = temp4 * intervalOriginal;
var start_time, now, then, then_refresh, elapsed, elapsed_refresh, cur_interval;

function game() {
    if (game_over) return;
    
    document.onkeydown = handleKeyDown;

    window.requestAnimationFrame(game);

    now = Date.now();

    elapsed = now - then;
    cur_interval = temp5 / (now - start_time + temp4);
    if (elapsed > cur_interval) {
        then = now;
        if (!dive()) {
            if (!build()) {
                var game_over_box = document.getElementById("game_over");
                game_over_box.innerHTML = "GAME OVER<br>Your score: " + score + "<br>GG!"
                return;
            }
        }
        renderTriangles();
    } else {
        elapsed_refresh = now - then_refresh;
        if (elapsed_refresh > intervalRefresh) {
            then_refresh = now;
            renderTriangles();
        }
    }
    
}

function main() {
    setupWebGL();
    loadTriangles();
    // clear elements
    for (var i = 0; i < boardHeight; i++) {
        grids[i] = new Array(boardLength);
        for (var j = 0; j < boardLength; j++) {
            grids[i][j] = -1;
        }
    }
    var game_over_box = document.getElementById("game_over");
    game_over_box.innerHTML = "";
    // game start
    score = 0;
    level = 0;
    updateLevel();
    game_over = false;
    nxt_type = Math.floor(Math.random() * 7);
    render_nextObject();
    setupShaders(0);
    start_time = Date.now();
    then = start_time;
    then_refresh = start_time;
    build();
    game();
}



/* other utilities */


/* next object canvas */
const edge_nextObject = 0.38;
const vertices_nextObject = {
    0: [
        // 0, 1, 2, 3
        (-1.5 - boundary) * edge_nextObject, boundary * edge_nextObject, 0,
        (-1.5 + boundary) * edge_nextObject, boundary * edge_nextObject, 0,
        (-1.5 + boundary) * edge_nextObject, -boundary * edge_nextObject, 0,
        (-1.5 - boundary) * edge_nextObject, -boundary * edge_nextObject, 0,
        // 4, 5, 6, 7
        (-0.5 - boundary) * edge_nextObject, boundary * edge_nextObject, 0,
        (-0.5 + boundary) * edge_nextObject, boundary * edge_nextObject, 0,
        (-0.5 + boundary) * edge_nextObject, -boundary * edge_nextObject, 0,
        (-0.5 - boundary) * edge_nextObject, -boundary * edge_nextObject, 0,
        // 8, 9, 10, 11
        (0.5 - boundary) * edge_nextObject, boundary * edge_nextObject, 0,
        (0.5 + boundary) * edge_nextObject, boundary * edge_nextObject, 0,
        (0.5 + boundary) * edge_nextObject, -boundary * edge_nextObject, 0,
        (0.5 - boundary) * edge_nextObject, -boundary * edge_nextObject, 0,
        // 12, 13, 14, 15
        (1.5 - boundary) * edge_nextObject, boundary * edge_nextObject, 0,
        (1.5 + boundary) * edge_nextObject, boundary * edge_nextObject, 0,
        (1.5 + boundary) * edge_nextObject, -boundary * edge_nextObject, 0,
        (1.5 - boundary) * edge_nextObject, -boundary * edge_nextObject, 0
    ],
    1 : [
        // 0, 1, 2, 3
        -boundary * edge_nextObject, (0.5 + boundary) * edge_nextObject, 0,
        boundary * edge_nextObject, (0.5 + boundary) * edge_nextObject, 0,
        boundary * edge_nextObject, (0.5 - boundary) * edge_nextObject, 0,
        -boundary * edge_nextObject, (0.5 - boundary) * edge_nextObject, 0,
        // 4, 5, 6, 7
        (1 - boundary) * edge_nextObject, (0.5 + boundary) * edge_nextObject, 0,
        (1 + boundary) * edge_nextObject, (0.5 + boundary) * edge_nextObject, 0,
        (1 + boundary) * edge_nextObject, (0.5 - boundary) * edge_nextObject, 0,
        (1 - boundary) * edge_nextObject, (0.5 - boundary) * edge_nextObject, 0,
        // 8, 9, 10, 11
        (-1 - boundary) * edge_nextObject, (-0.5 + boundary) * edge_nextObject, 0,
        (-1 + boundary) * edge_nextObject, (-0.5 + boundary) * edge_nextObject, 0,
        (-1 + boundary) * edge_nextObject, (-0.5 - boundary) * edge_nextObject, 0,
        (-1 - boundary) * edge_nextObject, (-0.5 - boundary) * edge_nextObject, 0,
        // 12, 13, 14, 15
        -boundary * edge_nextObject, (-0.5 + boundary) * edge_nextObject, 0,
        boundary * edge_nextObject, (-0.5 + boundary) * edge_nextObject, 0,
        boundary * edge_nextObject, (-0.5 - boundary) * edge_nextObject, 0,
        -boundary * edge_nextObject, (-0.5 - boundary) * edge_nextObject, 0
    ],
    2 : [
        // 0, 1, 2, 3
        (-1 - boundary) * edge_nextObject, (0.5 + boundary) * edge_nextObject, 0,
        (-1 + boundary) * edge_nextObject, (0.5 + boundary) * edge_nextObject, 0,
        (-1 + boundary) * edge_nextObject, (0.5 - boundary) * edge_nextObject, 0,
        (-1 - boundary) * edge_nextObject, (0.5 - boundary) * edge_nextObject, 0,
        // 4, 5, 6, 7
        -boundary * edge_nextObject, (0.5 + boundary) * edge_nextObject, 0,
        boundary * edge_nextObject, (0.5 + boundary) * edge_nextObject, 0,
        boundary * edge_nextObject, (0.5 - boundary) * edge_nextObject, 0,
        -boundary * edge_nextObject, (0.5 - boundary) * edge_nextObject, 0,
        // 8, 9, 10, 11
        -boundary * edge_nextObject, (-0.5 + boundary) * edge_nextObject, 0,
        boundary * edge_nextObject, (-0.5 + boundary) * edge_nextObject, 0,
        boundary * edge_nextObject, (-0.5 - boundary) * edge_nextObject, 0,
        -boundary * edge_nextObject, (-0.5 - boundary) * edge_nextObject, 0,
        // 12, 13, 14, 15
        (1 - boundary) * edge_nextObject, (-0.5 + boundary) * edge_nextObject, 0,
        (1 + boundary) * edge_nextObject, (-0.5 + boundary) * edge_nextObject, 0,
        (1 + boundary) * edge_nextObject, (-0.5 - boundary) * edge_nextObject, 0,
        (1 - boundary) * edge_nextObject, (-0.5 - boundary) * edge_nextObject, 0
    ],
    3 : [
        // 0, 1, 2, 3
        (-0.5 - boundary) * edge_nextObject, (0.5 + boundary) * edge_nextObject, 0,
        (-0.5 + boundary) * edge_nextObject, (0.5 + boundary) * edge_nextObject, 0,
        (-0.5 + boundary) * edge_nextObject, (0.5 - boundary) * edge_nextObject, 0,
        (-0.5 - boundary) * edge_nextObject, (0.5 - boundary) * edge_nextObject, 0,
        // 4, 5, 6, 7
        (0.5 - boundary) * edge_nextObject, (0.5 + boundary) * edge_nextObject, 0,
        (0.5 + boundary) * edge_nextObject, (0.5 + boundary) * edge_nextObject, 0,
        (0.5 + boundary) * edge_nextObject, (0.5 - boundary) * edge_nextObject, 0,
        (0.5 - boundary) * edge_nextObject, (0.5 - boundary) * edge_nextObject, 0,
        // 8, 9, 10, 11
        (-0.5 - boundary) * edge_nextObject, (-0.5 + boundary) * edge_nextObject, 0,
        (-0.5 + boundary) * edge_nextObject, (-0.5 + boundary) * edge_nextObject, 0,
        (-0.5 + boundary) * edge_nextObject, (-0.5 - boundary) * edge_nextObject, 0,
        (-0.5 - boundary) * edge_nextObject, (-0.5 - boundary) * edge_nextObject, 0,
        // 12, 13, 14, 15
        (0.5 - boundary) * edge_nextObject, (-0.5 + boundary) * edge_nextObject, 0,
        (0.5 + boundary) * edge_nextObject, (-0.5 + boundary) * edge_nextObject, 0,
        (0.5 + boundary) * edge_nextObject, (-0.5 - boundary) * edge_nextObject, 0,
        (0.5 - boundary) * edge_nextObject, (-0.5 - boundary) * edge_nextObject, 0
    ],
    4 : [
        // 0, 1, 2, 3
        (-1 - boundary) * edge_nextObject, (0.5 + boundary) * edge_nextObject, 0,
        (-1 + boundary) * edge_nextObject, (0.5 + boundary) * edge_nextObject, 0,
        (-1 + boundary) * edge_nextObject, (0.5 - boundary) * edge_nextObject, 0,
        (-1 - boundary) * edge_nextObject, (0.5 - boundary) * edge_nextObject, 0,
        // 4, 5, 6, 7
        (-1 - boundary) * edge_nextObject, (-0.5 + boundary) * edge_nextObject, 0,
        (-1 + boundary) * edge_nextObject, (-0.5 + boundary) * edge_nextObject, 0,
        (-1 + boundary) * edge_nextObject, (-0.5 - boundary) * edge_nextObject, 0,
        (-1 - boundary) * edge_nextObject, (-0.5 - boundary) * edge_nextObject, 0,
        // 8, 9, 10, 11
        -boundary * edge_nextObject, (-0.5 + boundary) * edge_nextObject, 0,
        boundary * edge_nextObject, (-0.5 + boundary) * edge_nextObject, 0,
        boundary * edge_nextObject, (-0.5 - boundary) * edge_nextObject, 0,
        -boundary * edge_nextObject, (-0.5 - boundary) * edge_nextObject, 0,
        // 12, 13, 14, 15
        (1 - boundary) * edge_nextObject, (-0.5 + boundary) * edge_nextObject, 0,
        (1 + boundary) * edge_nextObject, (-0.5 + boundary) * edge_nextObject, 0,
        (1 + boundary) * edge_nextObject, (-0.5 - boundary) * edge_nextObject, 0,
        (1 - boundary) * edge_nextObject, (-0.5 - boundary) * edge_nextObject, 0
    ],
    5 : [
        // 0, 1, 2, 3
        (1 - boundary) * edge_nextObject, (0.5 + boundary) * edge_nextObject, 0,
        (1 + boundary) * edge_nextObject, (0.5 + boundary) * edge_nextObject, 0,
        (1 + boundary) * edge_nextObject, (0.5 - boundary) * edge_nextObject, 0,
        (1 - boundary) * edge_nextObject, (0.5 - boundary) * edge_nextObject, 0,
        // 4, 5, 6, 7
        (-1 - boundary) * edge_nextObject, (-0.5 + boundary) * edge_nextObject, 0,
        (-1 + boundary) * edge_nextObject, (-0.5 + boundary) * edge_nextObject, 0,
        (-1 + boundary) * edge_nextObject, (-0.5 - boundary) * edge_nextObject, 0,
        (-1 - boundary) * edge_nextObject, (-0.5 - boundary) * edge_nextObject, 0,
        // 8, 9, 10, 11
        -boundary * edge_nextObject, (-0.5 + boundary) * edge_nextObject, 0,
        boundary * edge_nextObject, (-0.5 + boundary) * edge_nextObject, 0,
        boundary * edge_nextObject, (-0.5 - boundary) * edge_nextObject, 0,
        -boundary * edge_nextObject, (-0.5 - boundary) * edge_nextObject, 0,
        // 12, 13, 14, 15
        (1 - boundary) * edge_nextObject, (-0.5 + boundary) * edge_nextObject, 0,
        (1 + boundary) * edge_nextObject, (-0.5 + boundary) * edge_nextObject, 0,
        (1 + boundary) * edge_nextObject, (-0.5 - boundary) * edge_nextObject, 0,
        (1 - boundary) * edge_nextObject, (-0.5 - boundary) * edge_nextObject, 0
    ],
    6 : [
        // 0, 1, 2, 3
        -boundary * edge_nextObject, (0.5 + boundary) * edge_nextObject, 0,
        boundary * edge_nextObject, (0.5 + boundary) * edge_nextObject, 0,
        boundary * edge_nextObject, (0.5 - boundary) * edge_nextObject, 0,
        -boundary * edge_nextObject, (0.5 - boundary) * edge_nextObject, 0,
        // 4, 5, 6, 7
        (-1 - boundary) * edge_nextObject, (-0.5 + boundary) * edge_nextObject, 0,
        (-1 + boundary) * edge_nextObject, (-0.5 + boundary) * edge_nextObject, 0,
        (-1 + boundary) * edge_nextObject, (-0.5 - boundary) * edge_nextObject, 0,
        (-1 - boundary) * edge_nextObject, (-0.5 - boundary) * edge_nextObject, 0,
        // 8, 9, 10, 11
        -boundary * edge_nextObject, (-0.5 + boundary) * edge_nextObject, 0,
        boundary * edge_nextObject, (-0.5 + boundary) * edge_nextObject, 0,
        boundary * edge_nextObject, (-0.5 - boundary) * edge_nextObject, 0,
        -boundary * edge_nextObject, (-0.5 - boundary) * edge_nextObject, 0,
        // 12, 13, 14, 15
        (1 - boundary) * edge_nextObject, (-0.5 + boundary) * edge_nextObject, 0,
        (1 + boundary) * edge_nextObject, (-0.5 + boundary) * edge_nextObject, 0,
        (1 + boundary) * edge_nextObject, (-0.5 - boundary) * edge_nextObject, 0,
        (1 - boundary) * edge_nextObject, (-0.5 - boundary) * edge_nextObject, 0
    ]
}
const triangles_nextObject = [
    0, 1, 2, 0, 3, 2,
    4, 5, 6, 4, 7, 6,
    8, 9, 10, 8, 11, 10,
    12, 13, 14, 12, 15, 14
];

var gl_nextObject = null;
var colorULoc_nextObject;
var trianglesBuffer_nextObject;
var shaderProgram_nextObject;
function setup_nextObject() {
    // setup webgl
    var canvas = document.getElementById("nextObjectCanvas");
    gl_nextObject = canvas.getContext("webgl");

    // load
    trianglesBuffer_nextObject = gl_nextObject.createBuffer();
    gl_nextObject.bindBuffer(gl_nextObject.ELEMENT_ARRAY_BUFFER, trianglesBuffer_nextObject);
    gl_nextObject.bufferData(gl_nextObject.ELEMENT_ARRAY_BUFFER, new Uint16Array(triangles_nextObject), gl_nextObject.STATIC_DRAW);

    // setup shader
    var vShaderCode = `
        attribute vec3 coordinates;
        uniform vec3 color;

        varying vec4 fragColor;

        void main(void) {
            gl_Position = vec4(coordinates, 1.0);

            fragColor = vec4(color, 1.0);
        }
    `;
    var fShaderCode = `
        precision highp float;
        varying vec4 fragColor;

        void main(void) {
            gl_FragColor = fragColor;
        }
    `;
    var vShader = gl_nextObject.createShader(gl_nextObject.VERTEX_SHADER);
    gl_nextObject.shaderSource(vShader, vShaderCode);
    gl_nextObject.compileShader(vShader);
    var fShader = gl_nextObject.createShader(gl_nextObject.FRAGMENT_SHADER);
    gl_nextObject.shaderSource(fShader, fShaderCode);
    gl_nextObject.compileShader(fShader);
    shaderProgram_nextObject = gl_nextObject.createProgram();
    gl_nextObject.attachShader(shaderProgram_nextObject, vShader);
    gl_nextObject.attachShader(shaderProgram_nextObject, fShader);
    gl_nextObject.linkProgram(shaderProgram_nextObject);
    gl_nextObject.useProgram(shaderProgram_nextObject);

    colorULoc_nextObject = gl_nextObject.getUniformLocation(shaderProgram_nextObject, "color");
}
function render_nextObject() {
    setup_nextObject();

    // load
    var verticesBuffer_nextObject = gl_nextObject.createBuffer();
    gl_nextObject.bindBuffer(gl_nextObject.ARRAY_BUFFER, verticesBuffer_nextObject);
    gl_nextObject.bufferData(gl_nextObject.ARRAY_BUFFER, new Float32Array(vertices_nextObject[nxt_type]), gl_nextObject.STATIC_DRAW);

    gl_nextObject.uniform3fv(colorULoc_nextObject, colors[nxt_type]);

    // associate shader to buffer
    var coord_nextObject = gl_nextObject.getAttribLocation(shaderProgram_nextObject, "coordinates");
    gl_nextObject.vertexAttribPointer(coord_nextObject, 3, gl_nextObject.FLOAT, false, 0, 0);
    gl_nextObject.enableVertexAttribArray(coord_nextObject);
    
    // draw
    gl_nextObject.clearColor(0.0, 0.0, 0.0, 0.0);
    gl_nextObject.enable(gl_nextObject.DEPTH_TEST);
    gl_nextObject.clear(gl_nextObject.COLOR_BUFFER_BIT | gl_nextObject.DEPTH_BUFFER_BIT);

    gl_nextObject.bindBuffer(gl_nextObject.ELEMENT_ARRAY_BUFFER, trianglesBuffer_nextObject);
    gl_nextObject.drawElements(gl_nextObject.TRIANGLES, triangles_nextObject.length, gl_nextObject.UNSIGNED_SHORT, 0);
}


/* render frameworks */

function render_2dframe() {
    /* webgl and geometry data */
    var gl_2dframe = null;
    const vertices_2dframe = [];
    
    // setup webgl
    var canvas = document.getElementById("framework");
    gl_2dframe = canvas.getContext("webgl");
    const width = boardLength / 2;
    const height = boardHeight / 2;

    // horizontal
    for (var i = 0; i <= boardHeight; i++) {
        vertices_2dframe.push(
            -1, i / height - 1, 0,
            1, i / height - 1, 0
        );
    }
    // vertical
    for (var j = 0; j <= boardLength; j++) {
        vertices_2dframe.push(
            j / width - 1, -1, 0,
            j / width - 1, 1, 0
        );
    }

    // load
    var verticesBuffer_2dframe = gl_2dframe.createBuffer();
    gl_2dframe.bindBuffer(gl_2dframe.ARRAY_BUFFER, verticesBuffer_2dframe);
    gl_2dframe.bufferData(gl_2dframe.ARRAY_BUFFER, new Float32Array(vertices_2dframe), gl_2dframe.STATIC_DRAW);

    // setup shader
    var vShaderCode = `
        attribute vec3 coordinates;

        void main(void) {
            gl_Position = vec4(coordinates, 1.0);
        }
    `;
    var fShaderCode = `
        void main(void) {
            gl_FragColor = vec4(0.6, 0.6, 0.6, 0.6);
        }
    `;
    var vShader = gl_2dframe.createShader(gl_2dframe.VERTEX_SHADER);
    gl_2dframe.shaderSource(vShader, vShaderCode);
    gl_2dframe.compileShader(vShader);
    var fShader = gl_2dframe.createShader(gl_2dframe.FRAGMENT_SHADER);
    gl_2dframe.shaderSource(fShader, fShaderCode);
    gl_2dframe.compileShader(fShader);
    var shaderProgram_2dframe = gl_2dframe.createProgram();
    gl_2dframe.attachShader(shaderProgram_2dframe, vShader);
    gl_2dframe.attachShader(shaderProgram_2dframe, fShader);
    gl_2dframe.linkProgram(shaderProgram_2dframe);
    gl_2dframe.useProgram(shaderProgram_2dframe);

    // associate shader to buffer
    var coord_2dframe = gl_2dframe.getAttribLocation(shaderProgram_2dframe, "coordinates");
    gl_2dframe.vertexAttribPointer(coord_2dframe, 3, gl_2dframe.FLOAT, false, 0, 0);
    gl_2dframe.enableVertexAttribArray(coord_2dframe);

    // draw
    gl_2dframe.clearColor(0.0, 0.0, 0.0, 0.0);
    gl_2dframe.enable(gl_2dframe.DEPTH_TEST);
    gl_2dframe.clear(gl_2dframe.COLOR_BUFFER_BIT | gl_2dframe.DEPTH_BUFFER_BIT);
    gl_2dframe.drawArrays(gl_2dframe.LINES, 0, 2*(boardHeight+boardLength)+4);
}

function render_3dframe() {
    /* webgl and geometry data */
    var gl_3dframe = null;
    const vertices_3dframe = [];
    // horizontal
    for (var i = 0; i <= boardHeight; i++) {
        vertices_3dframe.push(
            i - boundary, -boundary, -boundary,
            i - boundary, boardLength - boundary, -boundary
        );
    }
    // vertical
    for (var j = 0; j <= boardLength; j++) {
        vertices_3dframe.push(
            -boundary, j - boundary, -boundary,
            boardHeight - boundary, j - boundary, -boundary
        );
    }

    // setup webgl
    var canvas = document.getElementById("framework");
    gl_3dframe = canvas.getContext("webgl");

    // load
    var verticesBuffer_3dframe = gl_3dframe.createBuffer();
    gl_3dframe.bindBuffer(gl_3dframe.ARRAY_BUFFER, verticesBuffer_3dframe);
    gl_3dframe.bufferData(gl_3dframe.ARRAY_BUFFER, new Float32Array(vertices_3dframe), gl_3dframe.STATIC_DRAW);
    
    // setup shader
    var vShaderCode = `
        attribute vec3 coordinates;
        uniform mat4 upvMatrix;

        void main(void) {
            gl_Position = upvMatrix * vec4(coordinates, 1.0);
        }
    `;
    var fShaderCode = `
        void main(void) {
            gl_FragColor = vec4(0.6, 0.6, 0.6, 0.6);
        }
    `;
    var vShader = gl_3dframe.createShader(gl_3dframe.VERTEX_SHADER);
    gl_3dframe.shaderSource(vShader, vShaderCode);
    gl_3dframe.compileShader(vShader);
    var fShader = gl_3dframe.createShader(gl_3dframe.FRAGMENT_SHADER);
    gl_3dframe.shaderSource(fShader, fShaderCode);
    gl_3dframe.compileShader(fShader);
    var shaderProgram_3dframe = gl_3dframe.createProgram();
    gl_3dframe.attachShader(shaderProgram_3dframe, vShader);
    gl_3dframe.attachShader(shaderProgram_3dframe, fShader);
    gl_3dframe.linkProgram(shaderProgram_3dframe);
    gl_3dframe.useProgram(shaderProgram_3dframe);

    var pvMatrixUniform_3dframe = gl_3dframe.getUniformLocation(shaderProgram_3dframe, "upvMatrix");
    gl_3dframe.uniformMatrix4fv(pvMatrixUniform_3dframe, gl_3dframe.FALSE, pvMatrix3d);

    // associate shader to buffer
    var coord_3dframe = gl_3dframe.getAttribLocation(shaderProgram_3dframe, "coordinates");
    gl_3dframe.vertexAttribPointer(coord_3dframe, 3, gl_3dframe.FLOAT, false, 0, 0);
    gl_3dframe.enableVertexAttribArray(coord_3dframe);

    // draw
    gl_3dframe.clearColor(0.0, 0.0, 0.0, 0.0);
    gl_3dframe.enable(gl_3dframe.DEPTH_TEST);
    gl_3dframe.clear(gl_3dframe.COLOR_BUFFER_BIT | gl_3dframe.DEPTH_BUFFER_BIT);
    gl_3dframe.drawArrays(gl_3dframe.LINES, 0, 2*(boardHeight+boardLength)+4);
}

var gl_firstPerson = null;
var verticesArray_firstPerson = new Array(boardHeight);
var trianglesArray_firstPerson = new Array(boardHeight);
var normalArray_firstPerson = new Array(boardHeight);
var vertexBuffer_firstPerson = new Array(boardHeight);
var normalBuffer_firstPerson = new Array(boardHeight);
var triangleBuffer_firstPerson = new Array(boardHeight);
var shaderProgram_firstPerson;
var vertexPositionAttrib_firstPerson;
var vertexNormalAttrib_firstPerson;
var vertexDiffuseAttrib_firstPerson;
var vertexAlphaAttrib_firstPerson;
var lightPositionULoc_firstPerson;
// read triangles in, load them into webgl buffers
// 4------5
// |\     |\
// | 0------1
// 7-|----6 |
//  \|     \|
//   3------2
// first person read-in follows order:
// {0, 1, 5, 4} - [0, 1, 5], [0, 4, 5] -> [0, 1, 2], [0, 3, 2]
// {0, 4, 7, 3} - [0, 4, 7], [0, 3, 7] -> [0, 1, 2], [0, 3, 2]
// {1, 2, 6, 5} - [1, 2, 6], [1, 5, 6] -> [0, 1, 2], [0, 3, 2]
function setup_firstPerson() {
    // setup webgl
    var canvas = document.getElementById("firstPersonCanvas");
    gl_firstPerson = canvas.getContext("webgl");
    
    // load
    for (var i = 0; i < boardHeight; i++) {
        verticesArray_firstPerson[i] = [];
        trianglesArray_firstPerson[i] = [];
        normalArray_firstPerson[i] = [];
        var offset = 0;
        for (var j = 0; j < boardLength; j++) {
            verticesArray_firstPerson[i].push(
                // {0, 1, 5, 4}
                i - boundary, j - boundary, boundary,
                i - boundary, j + boundary, boundary,
                i - boundary, j + boundary, -boundary,
                i - boundary, j - boundary, -boundary,
                // {0, 4, 7, 3}
                i - boundary, j - boundary, boundary,
                i - boundary, j - boundary, -boundary,
                i + boundary, j - boundary, -boundary,
                i + boundary, j - boundary, boundary,
                // {1, 2, 6, 5}
                i - boundary, j + boundary, boundary,
                i + boundary, j + boundary, boundary,
                i + boundary, j + boundary, -boundary,
                i - boundary, j + boundary, -boundary
            );
            trianglesArray_firstPerson[i].push(offset, offset + 1, offset + 2, offset, offset + 3, offset + 2);
            offset += 4;
            trianglesArray_firstPerson[i].push(offset, offset + 1, offset + 2, offset, offset + 3, offset + 2);
            offset += 4;
            trianglesArray_firstPerson[i].push(offset, offset + 1, offset + 2, offset, offset + 3, offset + 2);
            offset += 4;
            normalArray_firstPerson[i].push(-1,0,0,-1,0,0,-1,0,0,-1,0,0);
            normalArray_firstPerson[i].push(0,-1,0,0,-1,0,0,-1,0,0,-1,0);
            normalArray_firstPerson[i].push(0,1,0,0,1,0,0,1,0,0,1,0);
        }
        vertexBuffer_firstPerson[i] = gl_firstPerson.createBuffer(); // init empty vertex coord buffer
        gl_firstPerson.bindBuffer(gl_firstPerson.ARRAY_BUFFER, vertexBuffer_firstPerson[i]); // activate that buffer
        gl_firstPerson.bufferData(gl_firstPerson.ARRAY_BUFFER, new Float32Array(verticesArray_firstPerson[i]), gl_firstPerson.STATIC_DRAW); // coords to that buffer

        normalBuffer_firstPerson[i] = gl_firstPerson.createBuffer();
        gl_firstPerson.bindBuffer(gl_firstPerson.ARRAY_BUFFER, normalBuffer_firstPerson[i]);
        gl_firstPerson.bufferData(gl_firstPerson.ARRAY_BUFFER, new Float32Array(normalArray_firstPerson[i]), gl_firstPerson.STATIC_DRAW);
        
        // send the triangle indices to webGL
        triangleBuffer_firstPerson[i] = gl_firstPerson.createBuffer(); // init empty triangle index buffer
        gl_firstPerson.bindBuffer(gl_firstPerson.ELEMENT_ARRAY_BUFFER, triangleBuffer_firstPerson[i]); // activate that buffer
        gl_firstPerson.bufferData(gl_firstPerson.ELEMENT_ARRAY_BUFFER,new Uint16Array(trianglesArray_firstPerson[i]),gl_firstPerson.STATIC_DRAW); // indices to that buffer
    }

    // setup shader
    var fShaderCode = `
        precision highp float;
        varying vec4 fragColor;

        void main(void) {
            gl_FragColor = fragColor;
        }
    `;
    var vShaderCode = `
        attribute vec3 vertexPosition;
        attribute vec3 diffuse;
        attribute vec3 normal;
        attribute float alpha;
        varying vec4 fragColor;

        uniform mat4 upvMatrix;

        uniform vec3 lightPos;
        uniform vec3 eyePos;
        
        void main(void) {
            gl_Position = upvMatrix * vec4(vertexPosition, 1.0);

            vec3 ambient = diffuse * 0.2;

            vec3 light = normalize(lightPos - vertexPosition);
            float lambert = max(0.0, dot(normal, light));
            vec3 diffuse = diffuse * lambert;

            vec3 eye = normalize(eyePos - vertexPosition);
            vec3 halfVec = normalize(light + eye);
            float highlight = pow(max(0.0, dot(normal, halfVec)), 7.0);
            vec3 specular = diffuse * 0.2 * highlight;

            fragColor = vec4(ambient + diffuse + specular, alpha);
        }
    `;
    var vShader = gl_firstPerson.createShader(gl_firstPerson.VERTEX_SHADER);
    gl_firstPerson.shaderSource(vShader, vShaderCode);
    gl_firstPerson.compileShader(vShader);
    var fShader = gl_firstPerson.createShader(gl_firstPerson.FRAGMENT_SHADER);
    gl_firstPerson.shaderSource(fShader, fShaderCode);
    gl_firstPerson.compileShader(fShader);
    shaderProgram_firstPerson = gl_firstPerson.createProgram();
    gl_firstPerson.attachShader(shaderProgram_firstPerson, vShader);
    gl_firstPerson.attachShader(shaderProgram_firstPerson, fShader);
    gl_firstPerson.linkProgram(shaderProgram_firstPerson);
    gl_firstPerson.useProgram(shaderProgram_firstPerson);

    // associate shader to buffer
    vertexPositionAttrib_firstPerson = gl_firstPerson.getAttribLocation(shaderProgram_firstPerson, "vertexPosition"); 
    gl_firstPerson.enableVertexAttribArray(vertexPositionAttrib_firstPerson);
                
    vertexNormalAttrib_firstPerson = gl_firstPerson.getAttribLocation(shaderProgram_firstPerson, "normal");
    gl_firstPerson.enableVertexAttribArray(vertexNormalAttrib_firstPerson);

    vertexDiffuseAttrib_firstPerson = gl_firstPerson.getAttribLocation(shaderProgram_firstPerson, "diffuse");
    gl_firstPerson.enableVertexAttribArray(vertexDiffuseAttrib_firstPerson);

    vertexAlphaAttrib_firstPerson = gl_firstPerson.getAttribLocation(shaderProgram_firstPerson, "alpha");
    gl_firstPerson.enableVertexAttribArray(vertexAlphaAttrib_firstPerson);

    // light and positions
    var lightPositionULoc_firstPerson = gl_firstPerson.getUniformLocation(shaderProgram_firstPerson, "lightPos");
    gl_firstPerson.uniform3fv(lightPositionULoc_firstPerson, new vec3.fromValues(-boundary, (boardLength-1)/2.0, boardHeight * 2));
}
var diffuseArray_firstPerson = new Array(boardHeight);
var alphaArray_firstPerson = new Array(boardHeight);
var diffuseBuffer_firstPerson = new Array(boardHeight);
var alphaBuffer_firstPerson = new Array(boardHeight);
var eyePositionULoc_firstPerson;
function renderFirstPerson() {
    setup_firstPerson();

    // load viewing matrix and eye
    var cur_eye = new vec3.fromValues(model.eye[0], model.eye[1], 0);
    mat4.lookAt(
        viewMatrix_firstPerson,
        cur_eye,
        new vec3.fromValues(model.eye[0] + boardHeight, model.eye[1], 0),
        new vec3.fromValues(0, 0, -1)
    );
    mat4.multiply(pvMatrix_firstPerson, projMatrix_firstPerson, viewMatrix_firstPerson);
    pvMatrixUniform_firstPerson = gl_firstPerson.getUniformLocation(shaderProgram_firstPerson, "upvMatrix");
    gl_firstPerson.uniformMatrix4fv(pvMatrixUniform_firstPerson, gl_firstPerson.FALSE, pvMatrix_firstPerson);

    eyePositionULoc_firstPerson = gl_firstPerson.getUniformLocation(shaderProgram_firstPerson, "eyePos");
    gl_firstPerson.uniform3fv(eyePositionULoc_firstPerson, cur_eye);

    // load color and alpha
    for (var i = 0; i < boardHeight; i++) {
        diffuseArray_firstPerson[i] = [];
        alphaArray_firstPerson[i] = [];
        for (var j = 0; j < boardLength; j++) {
            if (grids[i][j] != -1) {
                for (var k = 0; k < 12; k++) {
                    diffuseArray_firstPerson[i].push(
                        colors[grids[i][j]][0],
                        colors[grids[i][j]][1],
                        colors[grids[i][j]][2]
                    );
                    alphaArray_firstPerson[i].push(1.0);
                }
            } else {
                for (var k = 0; k < 12; k++) {
                    diffuseArray_firstPerson[i].push(0, 0, 0);
                    alphaArray_firstPerson[i].push(0.0);
                }
            }
        }

        diffuseBuffer_firstPerson[i] = gl_firstPerson.createBuffer();
        gl_firstPerson.bindBuffer(gl_firstPerson.ARRAY_BUFFER, diffuseBuffer_firstPerson[i]);
        gl_firstPerson.bufferData(gl_firstPerson.ARRAY_BUFFER, new Float32Array(diffuseArray_firstPerson[i]), gl_firstPerson.STATIC_DRAW);

        alphaBuffer_firstPerson[i] = gl_firstPerson.createBuffer();
        gl_firstPerson.bindBuffer(gl_firstPerson.ARRAY_BUFFER, alphaBuffer_firstPerson[i]);
        gl_firstPerson.bufferData(gl_firstPerson.ARRAY_BUFFER, new Float32Array(alphaArray_firstPerson[i]), gl_firstPerson.STATIC_DRAW);
    }

    gl_firstPerson.clear(gl_firstPerson.COLOR_BUFFER_BIT | gl_firstPerson.DEPTH_BUFFER_BIT); // clear frame/depth buffers
    
    gl_firstPerson.blendFunc(gl_firstPerson.SRC_ALPHA, gl_firstPerson.ONE_MINUS_SRC_ALPHA);
    gl_firstPerson.enable(gl_firstPerson.BLEND);

    for (var i = 0; i < boardHeight; i++) {
        gl_firstPerson.bindBuffer(gl_firstPerson.ARRAY_BUFFER, vertexBuffer_firstPerson[i]);
        gl_firstPerson.vertexAttribPointer(vertexPositionAttrib_firstPerson, 3, gl_firstPerson.FLOAT, false, 0, 0);
            
        gl_firstPerson.bindBuffer(gl_firstPerson.ARRAY_BUFFER, normalBuffer_firstPerson[i]);
        gl_firstPerson.vertexAttribPointer(vertexNormalAttrib_firstPerson, 3, gl_firstPerson.FLOAT, false, 0, 0);

        gl_firstPerson.bindBuffer(gl_firstPerson.ARRAY_BUFFER, diffuseBuffer_firstPerson[i]);
        gl_firstPerson.vertexAttribPointer(vertexDiffuseAttrib_firstPerson, 3, gl_firstPerson.FLOAT, false, 0, 0);

        gl_firstPerson.bindBuffer(gl_firstPerson.ARRAY_BUFFER, alphaBuffer_firstPerson[i]);
        gl_firstPerson.vertexAttribPointer(vertexAlphaAttrib_firstPerson, 1, gl_firstPerson.FLOAT, false, 0, 0);

        // triangle buffer: activate and render
        gl_firstPerson.bindBuffer(gl_firstPerson.ELEMENT_ARRAY_BUFFER, triangleBuffer_firstPerson[i]); // activate
        gl_firstPerson.drawElements(gl_firstPerson.TRIANGLES, 18*boardLength, gl_firstPerson.UNSIGNED_SHORT, 0); // render
    }
}