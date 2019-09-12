// FIT2102 2019 Assignment 1
// https://docs.google.com/document/d/1Gr-M6LTU-tfm4yabqZWJYg-zTjEVqHKKTCvePGCYsUA/edit?usp=sharing


function asteroids() {

    // == README ==

    /*
    BONUS FEATURES ADDED:
    - Thrust movement
    - Colored asteroids that represent the asteroid's speed
    - Asteroids split into smaller ones when destroyed
     */

    /* EXTRA BONUS FEATURE (aiming for HD 90+):

     */

    /* DISCLAIMERS:
    - Yes, I know 'let' is bad practise
    - Any function that I haven't described as impure is pure
    - Any function that has side-effects is impure
    - Any function that reads from global constant is impure, but I feel that this isn't as bad
    as this is mostly to avoid having "magic numbers" or "magic strings"
    - The torus borders aren't perfect
    - Weird behaviour happens after the player dies (doesn't affect game play)
     */


    // == GAME SETTINGS ==
    const
        FPS = 60,
        SCREEN_MARGIN = 650;

    // Game mechanic constants (to avoid "magic numbers")
    const shipSpeed : number = 5, // Player's movement as pixels per frame (ppf)
        bulletColor : string = "#fff",
        bulletSpeed : number = 8, // Bullet movement ppf
        bulletLifeFrames : number = 90, // Frames that a bullet lasts for before disintegrating
        asteroidDivergence : number = 0.8, // Factor that an asteroid's children diverge from the original path by
        defaultAsteroidColor : string = "#000",
        minAsteroidRadius : number = 8,
        maxAsteroidRadius : number = 45,
        maxAsteroidSpeed : number = 4, // Asteroid's maximum speed in ppf (scalar: in either direction)
        biggestAsteroidConsidered : number = 100, // Biggest asteroid "considered" to be generated (Maybe be rejected for randomness, see spawnAsteroid func
        maxAsteroids : number = 2,
        bulletSize : number = 3, // Radius of bullets shot
        asteroidSpawnInterval : number = 1000, // Every n milliseconds that an asteroid attempts to spawn.
        shipHitboxRadius : number = 10; // Radius of the ship's circular hitbox from its centre

    // Basic helpers
    const rad = (deg: number) : number => deg * (Math.PI / 180); // Classic trig

    // Non-constant global variables (eww...)
    let gameOver : boolean = false; // Is the game over?
    let asteroidCount : number = 0; // The amount of asteroids naturally spawned (not from splitting)
    let score : number = 0;

    // Collision detection lists of elements
    const bullets : Elem[] = []; // Shared list of all bullet elements

    // == TYPES ==

    /*
    * Representation of a transformation that can be done on an svg element via the "transform" attribute.
    * Acts like a 2D vector or point, but considering rotation as well as position.
    * Useful for defining velocity functions for elements
    * */
    interface Transform {
        x: number;
        y: number;
        rot: number;
    }

    /* The heart of my functional programming based game.
    A function of this type describes how an element's position and rotation changes over time.
    Acts as a parametric equation describing the velocity and rotation of elements.
    Can be chained together to create more complex transformation functions.
     */
    type TransFunc = (t: Transform) => Transform


    // == BASIC SVG ELEMENTS ==

    const svg = document.getElementById("canvas")!;

    const g = new Elem(svg, 'g')
        .attr("transform", "translate(300 300) rotate(0)");

    const ship = new Elem(svg, 'polygon', g.elem)
        .attr("points", "-15,20 15,20 0,-20")
        .attr("style", "fill:black;stroke:white;stroke-width:5");

    const scoreElement = new Elem(svg, "text") // Draw game over screen
        .attr("x", "10px")
        .attr("y", "30px")
        .attr("fill", "#fff")
        .attr("style", "font: bold 24px sans-serif;")
    scoreElement.elem.innerHTML = "Score:";

    // == ELEMENT TRANSFORMATION FUNCTIONS (MOVEMENT) ==

    // Pure Movement Functions

    // Turns a Transform into a floor'd version of itself. i.e. all values have Math.floor() applied to it
    const floorTransform = (t: Transform) : Transform => ({x: Math.floor(t.x), y: Math.floor(t.y), rot: Math.floor(t.rot)});

    // Turns a Transform into a version of itself which is bounded by a given square plane. (In this case, the size of the window)
    // Applies a torus topology to any Transform
    function keepInBounds(t: Transform, bound: number): Transform {
        const reorient = (n: number) => n < 0 ? (n % bound) + bound : n % bound; // Func that keeps a given n within a given bound via mod
        return {x: reorient(t.x), y: reorient(t.y), rot: t.rot} // Applied to each property of a Transform
    }


    // Movement Display Functions

    // Applies a transformation function (TransFunc) to a svg element (the basis of movement)
    // Impure side-effect: moves an element on the screen (IO)
    function transformElement(elem: Elem, f: TransFunc) : void {
        const current = position(elem); // The position the element is currently in
        const result = keepInBounds(floorTransform(f(current)), SCREEN_MARGIN); // Keep the element within the bounds of the screen and floor it
        elem.attr("transform", `translate(${result.x} ${result.y}) rotate(${result.rot})`) // Apply each value to the svg element via Elem.attr
    }

    // Return the current position of any svg element (assuming it has been defined) as a Transform
    // Impure: Takes information from the screen, outside of the function body
    function position(elem: Elem) {
        const parts = elem.attr("transform")
            // Apply an ugly regex to the transform attribute to extract the floating point values
            .match(/translate\((-*[0-9]+\.*[0-9]*)\s(-*[0-9]+\.*[0-9]*)\)\srotate\((-*[0-9]+\.*[0-9]*)\)/)!
            .splice(1)! // We don't want the whole string
            .map(n => parseInt(n)); // To ints
        return {x: parts[0], y: parts[1], rot: parts[2]} // Construct a Transform object
    }

    // == SHIP CONTROLS ==

    // OBSERVABLE: providing key presses
    const controls = Observable
        .fromEvent<KeyboardEvent>(document, "keypress")
        .filter(_=>!gameOver) // Only provide if the game isn't over
        .filter(event => !event.repeat) // Remove repeating key presses
        .map(event => event.key); // Only provide the key value itself

    // Allow a given element to be controlled using a key stroke, animated using a given TransFunc
    // A keyFilter is used in case you wanted more than one key to be bound to an action, or for it to change over time. (More flexible)
    // Impure: Takes data from user input observable (IO)
    // Side-effect: moves an element on the screen (IO)
    function controlElement(elem: Elem, keyObs: Observable<string>, keyFilter: (_: string) => boolean, f: TransFunc): void {
        keyObs
            .filter(keyFilter)
            .subscribe(_ => {
                const cancel = Observable.fromEvent<KeyboardEvent>(document, "keyup")
                    .map(event => event.key)
                    .filter(keyFilter);
                const velocity = Observable.interval(1000 / FPS).takeUntil(cancel);
                velocity.subscribe(_ => transformElement(g, f));
            });
    }

    // Pure transform functions describing ship and bullet movement
    const
        forward = (t: Transform) => ({ // Thrust movement forward
            x: ((t.x + (Math.sin(rad(t.rot)) * shipSpeed))),
            y: (t.y - (Math.cos(rad(t.rot)) * shipSpeed)),
            rot: t.rot
        }),
        backward = (t: Transform) => ({ // Thrust movement forward
            x: ((t.x - (Math.sin(rad(t.rot)) * shipSpeed))),
            y: (t.y + (Math.cos(rad(t.rot)) * shipSpeed)),
            rot: t.rot
        }),
        // Rotate left or right
        right = (t: Transform) => ({x: t.x, y: t.y, rot: (t.rot + shipSpeed)}),
        left = (t: Transform) => ({x: t.x, y: t.y, rot: (t.rot - shipSpeed)});

    // Definition of controls
    controlElement(g, controls, k => k == "w", forward);
    controlElement(g, controls, k => k == "a", left);
    controlElement(g, controls, k => k == "s", backward);
    controlElement(g, controls, k => k == "d", right);

    // == BULLETS/SHOOTING ==

    // Produce a bullet coming out of a given element (for reusability) given a timeout and velocity function
    // Impure: Draws information outside of the function body, being positions of existing elements
    // Side-effect: Draws on screen (IO)
    function shootFrom(elem: Elem, bulletTimeout: number, velocityFunc: TransFunc) : void {
        const bullet = new Elem(svg, 'circle') // Draw bullet
            .attr("r", bulletSize.toString())
            .attr("fill", bulletColor)
            .attr("transform", "translate(0 0) rotate(0)");
        // Add it to the list of "alive" bullets
        let liveBullet = true;
        bullets.push(bullet);
        // Observable describing its death
        const bulletDeath = Observable.interval(bulletTimeout);
        bulletDeath.subscribe(_ => {
            if (liveBullet) deleteBullet(bullet); // Kill the bullet only if it was alive (no zombie bullets)
            liveBullet = false; // It is now dead, can't be killed again
        });
        // Move it to the starting position in-front of what shot it out
        const startingPos = position(elem);
        transformElement(bullet, _ => startingPos);

        // Observable describing how it moves every frame (via a TransFunc)
        Observable.interval(1000 / FPS)
            .takeUntil(bulletDeath) // Stop moving once it "dies"
            .subscribe(_ => transformElement(bullet, velocityFunc)) // Move
    }

    // Pure transform function describing bullet velocity
    const bulletMovement = (t: Transform) : Transform => ({
        x: ((t.x + (Math.sin(rad(t.rot)) * bulletSpeed))),
        y: (t.y - (Math.cos(rad(t.rot)) * bulletSpeed)),
        rot: t.rot
    });

    // OBSERVABLE: for player shooting controls
    controls
        .filter(k => k == " ")
        .subscribe(_ => {
            shootFrom(g, bulletLifeFrames * 1000/FPS, bulletMovement)
        });

    // Delete a bullet safely and stop asteroids from checking for it
    // Impure side-effects: Draws onto the screen AND modifies an external array of bullets
    function deleteBullet(bullet:Elem) : void {
        const index = bullets.indexOf(bullet);
        if (index >= 0) bullets.splice(bullets.indexOf(bullet), 1); // Only delete it if it hasn't been already
        bullet.attr("visibility", "hidden") // Hide it
    }

    // Kill the player's ship and enter a gameOver state
    // Impure side-effects: Modifies global, mutable gameOver state and draws on the screen
    function killPlayer(ship:Elem) : void {
        ship.attr("visibility", "hidden"); // Hide the ship
        gameOver = true;
        new Elem(svg, "text") // Draw game over screen
            .attr("x", "50%")
            .attr("y", "50%")
            .attr("text-anchor", "middle")
            .attr("fill", "#fff")
            .attr("style", "font: bold 40px sans-serif;")
            .elem.innerHTML = "GAME OVER"
    }

    // == ASTEROIDS ==


    /* CURRIED: Takes the radius of an asteroid and produces a function which can be
    * fed into updateScore every time an asteroid is destroyed.
    * The resulting function provides a new score proportional to the radius of the asteroid destroyed, meaning
    * bigger asteroids score better. Adds a bit of strategy to the game.
    * */
    const asteroidScoreFunc = (radius:number) => (oldScore:number) => (oldScore + Math.ceil(radius) * 100);

    // Spawn a new asteroid of size radius, starting at initPos moving using a TransFunc. Can set a color optionally
    // Impure: Reads from global bullet list and draws to the screen
    function spawnAsteroid(radius:number, initPos:Transform, velocityFunc:TransFunc, color?:string) : void {
        color = color === undefined? defaultAsteroidColor : color; // Set to default color if not defined
        const asteroid = new Elem(svg, 'circle') // Draw asteroid
            .attr("r", radius.toString())
            .attr("fill", color)
            .attr("style", "stroke:white;stroke-width:5")
            .attr("transform", "translate(0 0) rotate(0)");
        transformElement(asteroid, _ => initPos); // Move asteroid to the starting position
        let deleted = false;
        // Observer that controls the movement and collision behaviour of each asteroid every frame
        const controller = Observable.interval(1000/FPS);
        controller.subscribe(_ => {
            if (!deleted) { // ONLY perform any behaviour if the asteroid has not been destroyed
                // Move the element according to the velocity function
                transformElement(asteroid, velocityFunc);
                // Kill the player if it collides with it
                if (collidedWithShip(asteroid, radius)) killPlayer(ship);
                // Check if it has been shot by any currently alive bullet
                const bullet = gotShot(asteroid, radius);
                if (bullet) { // If it has,
                    deleted = true;
                    deleteBullet(bullet); // Delete the bullet that shot it
                    asteroidCount--;
                    // Update the score by generating a score function and using it to modify the score based on its radius.
                    updateScore(asteroidScoreFunc(radius));
                    // Spawn two new, smaller asteroids
                    color = color === undefined? defaultAsteroidColor : color; // Color is the same as the parent if it was defined
                    if (radius >= minAsteroidRadius * 2) { // Only multiply if it is big enough to have children larger than the minimum asteroid size
                        // Spawn both asteroids of half radius.
                        // Provide a velocity function the same as the parent but with a slight tweak; each axis diverges slightly
                        spawnAsteroid(radius/2, position(asteroid),
                            t=>velocityFunc({x: t.x-asteroidDivergence, y: t.y+asteroidDivergence, rot: 0}), color);
                        spawnAsteroid(radius/2, position(asteroid),
                            t=>velocityFunc({x: t.x+asteroidDivergence, y: t.y-asteroidDivergence, rot: 0}), color)
                    }
                    // Remove the asteroid element (reduces lag in theory)
                    asteroid.elem.remove();
                }
            }
        });
    }

    // Calculate the scalar difference between two points (as Transforms) via Pythagoras
    const distance = (u:Transform, v:Transform) : number => Math.sqrt(Math.abs((v.x - u.x)**2 + (v.y - u.y)**2));

    /* CURRIED (kind of): Test if two elements collide, each with two circular hitboxes of a given radius. Returns a boolean.
    * Technically it's not fully curried since each function takes two parameters. I did this because it enables us to
    * generate functions that test "have I collided with this specific element with this radius". Quite useful for
    * testing collision with a commonly collided-with element such as the player.
    */
    const collision = (elem1:Elem, radius1:number) => (elem2:Elem, radius2:number) =>
        distance(position(elem1), position(elem2)) <= radius1 + radius2;

    // Test if a given element with a given radius collides with the player.
    // Derived from curried function above.
    const collidedWithShip = collision(g, shipHitboxRadius);

    // Test if a given element collided with an alive bullet. Returns the bullet that shot the element if it was shot;
    // undefined otherwise.
    const gotShot = (object:Elem, radius:number): Elem | undefined => bullets
        .filter(bullet => collision(object, radius)(bullet, bulletSize))[0];

    // OBSERVABLE: Asteroid spawner that attempts to spawn an asteroid at a given interval specified above.
    Observable.interval(asteroidSpawnInterval)
        .map(_=>({ // Generate random properties of an asteroid
            size: Math.random()*biggestAsteroidConsidered,
            yPos: (Math.random()*10000) % SCREEN_MARGIN, // Only spawn on screen's edge
            xVelocity: maxAsteroidSpeed - Math.random() * maxAsteroidSpeed * 2, // x Velocity between -maxSpeed and +maxSpeed including 0
            yVelocity: maxAsteroidSpeed - Math.random() * maxAsteroidSpeed * 2  // Same as above for y
        }))
        /* Remove any asteroid that WOULD have spawned with a size larger that what is described.
         * This is what's meant by maximum considered size. This aims to add a touch of randomness
         * to when asteroids spawn using a one-liner higher-order function
         * */
        .filter(rand => rand.size > minAsteroidRadius && rand.size < maxAsteroidRadius)
        // For every successful asteroid spawn:
        .subscribe(rand => {
            if (asteroidCount < maxAsteroids) { // If we have space for another asteroid within the cap
                asteroidCount++;
                spawnAsteroid( // Spawn an asteroid with the following randomised properties
                    rand.size, // A random radius
                    {x: SCREEN_MARGIN, y: rand.yPos,  rot: 0}, // Starting position
                    t => ({x: rand.xVelocity + t.x, y: rand.yVelocity + t.y, rot: 0}), // Velocity function
                    // Color of the asteroid which depends on how fast a given asteroid is. Slower ones have lower hues, faster have higher hues.
                    // Makes my assignment stand out a little bit. (A bit of extra functionality maybe?)
                    `hsl(${Math.abs(rand.xVelocity) * Math.abs(rand.yVelocity) * (360/(maxAsteroidSpeed**2))}, 100%, 50%)`
                );
            }
        });

    // SCORE

    // Changes the score of the player and updates it onto the screen. How the score changes
    // is modelled by a function which takes in the old score and produces a new one. Like "mapping" to the score.
    // This allows for extra flexibility with scoring.
    // Impure side-effects: Modifies a global mutable variable "score" and draws the score to the screen.
    function updateScore(f : (_:number) => number) : void {
        const newScore = Math.round(f(score));
        scoreElement.elem.innerHTML = "Score: " + newScore.toString();
        score = newScore
    }

    // Update the score to its initial value when the game starts.
    updateScore(_ => score);
}
// the following simply runs your asteroids function on window load.  Make sure to leave it in place.
if (typeof window != 'undefined')
  window.onload = ()=>{
    asteroids();
  };

 

 
