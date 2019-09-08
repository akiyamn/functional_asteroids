// FIT2102 2019 Assignment 1
// https://docs.google.com/document/d/1Gr-M6LTU-tfm4yabqZWJYg-zTjEVqHKKTCvePGCYsUA/edit?usp=sharing


function asteroids() {

  // Inside this function you will use the classes and functions 
  // defined in svgelement.ts and observable.ts
  // to add visuals to the svg element in asteroids.html, animate them, and make them interactive.
  // Study and complete the Observable tasks in the week 4 tutorial worksheet first to get ideas.

  // You will be marked on your functional programming style
  // as well as the functionality that you implement.
  // Document your code!  
  // Explain which ideas you have used ideas from the lectures to 
  // create reusable, generic functions.

  // GAME SETTINGS
  const
      FPS = 60,
      SCREEN_MARGIN = 650;

  const svg = document.getElementById("canvas")!;
  // make a group for the spaceship and a transform to move it and rotate it
  // to animate the spaceship you will update the transform property
  let g = new Elem(svg,'g')
    .attr("transform","translate(300 300) rotate(0)");
  
  // create a polygon shape for the space ship as a child of the transform group
  let ship = new Elem(svg, 'polygon', g.elem) 
    .attr("points","-15,20 15,20 0,-20")
    .attr("style","fill:lime;stroke:purple;stroke-width:1");

  interface Transform {
    x: number;
    y: number;
    rot: number;
  }
  type TransFunc = (t: Transform) => Transform

  function transformElement(elem:Elem, f:TransFunc) : void {
    const current = currentPosition(elem);
    const result = floorTransform(f(current));
    elem.attr("transform", `translate(${result.x} ${result.y}) rotate(${result.rot})`)
  }

  function controlElement(elem:Elem, keyObs:Observable<string>, keyFilter:(_:string)=>boolean, f:TransFunc) : void{
    keyObs
        .filter(keyFilter)
        .subscribe(_ => {
          const cancel = Observable.fromEvent<KeyboardEvent>(document, "keyup")
              .map(event => event.key)
              .filter(keyFilter);
          const velocity = Observable.interval(1000/FPS).takeUntil(cancel);
          velocity.subscribe(_=>transformElement(g, t=>keepInBounds(f(t), SCREEN_MARGIN)));
        });
  }

    function currentPosition(elem:Elem){
        const parts = elem.attr("transform")
            .match(/translate\((-*[0-9]+\.*[0-9]*)\s(-*[0-9]+\.*[0-9]*)\)\srotate\((-*[0-9]+\.*[0-9]*)\)/)!
            .splice(1)!
            .map(n => parseInt(n));
        return {x: parts[0], y: parts[1], rot: parts[2]}
    }

  const controls = Observable
      .fromEvent<KeyboardEvent>(document, "keypress")
      .filter(event => !event.repeat)
      .map(event => event.key);

  const rad = (deg:number) => deg * (Math.PI/180);
  const floorTransform = (t:Transform) => ({x: Math.floor(t.x), y: Math.floor(t.y), rot: Math.floor(t.rot)});
  function keepInBounds(t:Transform, bound:number) : Transform {
      const reorient = (n:number) => n < 0? (n % bound) + bound : n % bound;
      return {x: reorient(t.x), y: reorient(t.y), rot: t.rot}
  }

    const
        forward = (t:Transform) => ({x: ((t.x + (Math.sin(rad(t.rot))*5))), y: (t.y - (Math.cos(rad(t.rot))*5)), rot: t.rot}),
        backward = (t:Transform) => ({x: ((t.x - (Math.sin(rad(t.rot))*5))), y: (t.y + (Math.cos(rad(t.rot))*5)), rot: t.rot}),
        right = (t:Transform) => ({x: t.x, y: t.y, rot: (t.rot+5)}),
        left = (t:Transform) => ({x: t.x, y: t.y, rot: (t.rot-5)});

  const shoot = controls
      .filter(k=>k==" ")
      .subscribe(_=>{
          const bullet = new Elem(svg,'circle')
              .attr("r", "3")
              .attr("fill", "#fff")
              .attr("transform","translate(0 0) rotate(0)");
          const deleteBullet = Observable.interval(5000);
            deleteBullet.subscribe(_=>bullet.attr("visibility", "hidden"));
          const shipPos = currentPosition(g);
          transformElement(bullet, _=>shipPos);
          const velocity = Observable.interval(1000/FPS)
              .takeUntil(deleteBullet)
              .subscribe(_=>transformElement(bullet,
                  (t:Transform) => ({
                      x: ((t.x + (Math.sin(rad(t.rot))*8))),
                      y: (t.y - (Math.cos(rad(t.rot))*8)),
                      rot: t.rot
                  })
              ))
      });

  controlElement(g, controls, k=>k=="w", forward);
  controlElement(g, controls, k=>k=="a", left);
  controlElement(g, controls, k=>k=="s", backward);
  controlElement(g, controls, k=>k=="d", right);

  controls
      .subscribe(console.log)
}

// the following simply runs your asteroids function on window load.  Make sure to leave it in place.
if (typeof window != 'undefined')
  window.onload = ()=>{
    asteroids();
  }

 

 
