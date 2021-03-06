inlets = 2;
outlets = 3;

var bits = new Array(1024); // 32x32 matrix
var x,y,state,nx,ny,i,j;
var tilt = new Array(2);
var pos = new Array(2); // need to fill with zeroes
var xpos = new Array(2); // int arrays that store current 0-31 step offset
var ypos = new Array(2);
var localx = 16;
var localy = 8;
var ledRow = 0;
var ledRow2 = 0;
var c = 0;
var start = 0;
var loopStart = 0;
var loopLength = 16;
var currentStep = 0;
var stepRow1 = 255;
var stepRow2 = 255;
var loopModulo = 0;
var stepOut = new Array(7);

for(i=0;i<1024;i++) bits[i] = 0 // sets whole array to 0 on load
pos[0] = 0; // empty 'current' position floats
pos[1] = 0;
xpos[0] = 0; // empty 'current' position floats
xpos[1] = 0;
ypos[0] = 0; // empty 'current' position floats
ypos[1] = 0;
tilt[0] = 0; // initialise tilt at zero (only needed while tilt not hooked up)
tilt[1] = 0;


	// send a 'step' message anytime you want to move to trigger notes (tempo)
function step() {
	outlet(1,(currentStep%16),loopStart,loopLength); // output the current step (testing only)
	for(i=0;i<7;i++) stepOut[i] = bits[(xpos[0]+(currentStep%16)+(32*(ypos[0]+1+i))+1024)%1024]
	outlet(2,stepOut); // send to the rhythm generator
	flashStep();
	currentStep = ((currentStep + 1 - loopStart)%loopLength)+loopStart; // increment the step by 1
}

function key(x,y,s) {
	if (y==0) { // if top row, treat separately
		c = c + ((s*2)-1); // count number of presses
		if(c == 1 && start == 0) { // if currently stopped (no presses) and the count changes to 1
			start = 1; // change 'counting-up' flag to 1
			currentStep = x; // jump to the new x-input value
			loopStart = x; // start the loop at the first press
			loopLength = localx; // set the loop length to the full width
			stepRow1 = 255;
			stepRow2 = 255;
			redrawMap();
		}

		else if(c>1 && s==1) { // interpret double-press & loop
			if(x > loopStart) loopLength = x - loopStart;
			else loopLength = (x+16) - loopStart;
			stepRow1 = 0;
			stepRow2 = 0;
			for(i=0;i<loopLength;i++) { // iterate through all active steps
				if(((i+loopStart)%16) < 8) stepRow1 = stepRow1 + (1<<((i+loopStart)%16))
				else stepRow2 = stepRow2 + (1<<((i+loopStart-8)%16));
			}
			redrawMap();
		}
		
		// if we are started and the count hits zero, then revert to !started
		else if(c == 0 && start == 1) {
			start = 0; // now count has hit zero after being positive
		}
	}
	
	else if (s==1) { // if a press (not a release)
		nx = (32+x+xpos[0])%32; // x.keypress + current.x.position(float)
		ny = (32+y+ypos[0])%32; //

		bits[(nx+(32*ny))%1024] = (1+bits[(nx+(32*ny))%1024])%2 // adds 1 then wraps to 1

		ledSet(x,y,bits[(nx+32*ny)%1024]); // explicitly lights the led before tilt changes
	}
}


function tiltin(n,x,y,z) {

	if(n==0) {
		tilt[0] = y/768; // scale input down (change sensitivity of tilt here)
		tilt[1] = x/768;
		
		for(i=0;i<2;i++) {
			if(tilt[i]<0.025 && tilt[i]>-0.025) tilt[i] = 0 // sets  a deadzone at centre
			else if(tilt[i]>=0.025) tilt[i] = tilt[i]-0.025
			else tilt[i] = tilt[i]+0.025
		}
	}
	
	// updates the current pos[float] to the new location after tilt added
	pos[0] = (pos[0] + tilt[0])%32; // wrapped to 32 so pos never exceeds limits
	pos[1] = (pos[1] + tilt[1])%32;



    if(ypos[0] != ypos[1] || xpos[0] != xpos[1]) { // if the position has changed to a new int division
		// we call a redraw of the bitmap with the current xpos & ypos offsets mapped to the device
		redrawMap();
	}

	// should use Math.floor instead?
	
	// then we shift the values through to prepare for new input

	ypos[1] = ypos[0]; // ypos(memory) becomes old ypos(now)
	ypos[0] = Math.round(pos[0]); // ypos(now) becomes the int'd pos
	xpos[1] = xpos[0];
	xpos[0] = Math.round(pos[1]); //
		// wrap these to 32 so they don't forever accumulate in 1 direction
}



function localsize(x,y) {
	localx = x;
	localy = y;
	// update the internally accessed size (specifically for creating led output)
}

function redrawMap() {	
	for(i=1;i<localy;i++) { // iterate through the physically focussed cells (skip first row)
		for(j=0;j<localx;j++) {
			nx = (32+j+xpos[0])%32;
			ny = (32+i+ypos[0])%32;
			
		// find the referenced cell in the array & bitshift it relative to col position
			if(j<8) ledRow = ledRow + (bits[(nx+32*ny)%1024]<<j)
		// if in second quad add it to the second accumulator
			else ledRow2 = ledRow2 + (bits[(nx+32*ny)%1024]<<(j-8))
		}
	// format for /led/row and bang out straight to serialosc
		outlet(0,"/tiltrap/grid/led/row",0,i,ledRow,ledRow2);
	//reset counters for next row
		ledRow = 0;
		ledRow2 = 0;
	}
	
		// then we overlay the step counter on top
	outlet(0,"/tiltrap/grid/led/row",0,0,stepRow1,stepRow2);


}

function ledSet(x,y,s) {
	outlet(0,"/tiltrap/grid/led/set",x,y,s);
}

function flashStep() {
	if((currentStep %16)<8) { // if step is in 1st quadrant
		outlet(0,"/tiltrap/grid/led/row",0,0,stepRow1-(1<<currentStep),stepRow2);
	}
	else { // if step is in 2nd quadrant
		outlet(0,"/tiltrap/grid/led/row",0,0,stepRow1,stepRow2-(1<<(currentStep-8)));
	}
	
	outlet(1,"flash");

}

function flash() {
	outlet(0,"/tiltrap/grid/led/row",0,0,stepRow1,stepRow2);
}