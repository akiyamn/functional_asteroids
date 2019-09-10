"use strict";
function asteroids() {
    const FPS = 60, SCREEN_MARGIN = 650;
    const svg = document.getElementById("canvas");
    let g = new Elem(svg, 'g')
        .attr("transform", "translate(300 300) rotate(0)");
    let ship = new Elem(svg, 'polygon', g.elem)
        .attr("points", "-15,20 15,20 0,-20")
        .attr("style", "fill:black;stroke:white;stroke-width:5");
    const rad = (deg) => deg * (Math.PI / 180);
    const floorTransform = (t) => ({ x: Math.floor(t.x), y: Math.floor(t.y), rot: Math.floor(t.rot) });
    function keepInBounds(t, bound) {
        const reorient = (n) => n < 0 ? (n % bound) + bound : n % bound;
        return { x: reorient(t.x), y: reorient(t.y), rot: t.rot };
    }
    function transformElement(elem, f) {
        const current = position(elem);
        const result = keepInBounds(floorTransform(f(current)), SCREEN_MARGIN);
        elem.attr("transform", `translate(${result.x} ${result.y}) rotate(${result.rot})`);
    }
    function controlElement(elem, keyObs, keyFilter, f) {
        keyObs
            .filter(keyFilter)
            .subscribe(_ => {
            const cancel = Observable.fromEvent(document, "keyup")
                .map(event => event.key)
                .filter(keyFilter);
            const velocity = Observable.interval(1000 / FPS).takeUntil(cancel);
            velocity.subscribe(_ => transformElement(g, f));
        });
    }
    function position(elem) {
        const parts = elem.attr("transform")
            .match(/translate\((-*[0-9]+\.*[0-9]*)\s(-*[0-9]+\.*[0-9]*)\)\srotate\((-*[0-9]+\.*[0-9]*)\)/)
            .splice(1)
            .map(n => parseInt(n));
        return { x: parts[0], y: parts[1], rot: parts[2] };
    }
    const controls = Observable
        .fromEvent(document, "keypress")
        .filter(_ => !gameOver)
        .filter(event => !event.repeat)
        .map(event => event.key);
    const forward = (t) => ({
        x: ((t.x + (Math.sin(rad(t.rot)) * 5))),
        y: (t.y - (Math.cos(rad(t.rot)) * 5)),
        rot: t.rot
    }), backward = (t) => ({
        x: ((t.x - (Math.sin(rad(t.rot)) * 5))),
        y: (t.y + (Math.cos(rad(t.rot)) * 5)),
        rot: t.rot
    }), right = (t) => ({ x: t.x, y: t.y, rot: (t.rot + 5) }), left = (t) => ({ x: t.x, y: t.y, rot: (t.rot - 5) });
    controlElement(ship, controls, k => k == "w", forward);
    controlElement(g, controls, k => k == "a", left);
    controlElement(g, controls, k => k == "s", backward);
    controlElement(g, controls, k => k == "d", right);
    const bullets = [];
    function shootFrom(elem, bulletTimeout, velocityFunc) {
        const bullet = new Elem(svg, 'circle')
            .attr("r", bulletSize.toString())
            .attr("fill", "#fff")
            .attr("transform", "translate(0 0) rotate(0)");
        let liveBullet = true;
        bullets.push(bullet);
        const bulletDeath = Observable.interval(bulletTimeout);
        bulletDeath.subscribe(_ => {
            if (liveBullet) {
                deleteBullet(bullet);
            }
            liveBullet = false;
        });
        const startingPos = position(elem);
        transformElement(bullet, _ => startingPos);
        const velocity = Observable.interval(1000 / FPS)
            .takeUntil(bulletDeath)
            .subscribe(_ => transformElement(bullet, velocityFunc));
    }
    let gameOver = false;
    function killPlayer(ship) {
        ship.attr("visibility", "hidden");
        gameOver = true;
        new Elem(svg, "text")
            .attr("x", "50%")
            .attr("y", "50%")
            .attr("text-anchor", "middle")
            .attr("fill", "#fff")
            .attr("style", "font: bold 40px sans-serif;")
            .elem.innerHTML = "GAME OVER";
    }
    const bulletMovement = (t) => ({
        x: ((t.x + (Math.sin(rad(t.rot)) * 8))),
        y: (t.y - (Math.cos(rad(t.rot)) * 8)),
        rot: t.rot
    });
    const shoot = controls
        .filter(k => k == " ")
        .subscribe(_ => {
        shootFrom(g, 90 * 1000 / FPS, bulletMovement);
    });
    const asteroidDivergence = 0.8;
    function spawnAsteroid(radius, initPos, velocityFunc, color) {
        color = color === undefined ? "#000" : color;
        const asteroid = new Elem(svg, 'circle')
            .attr("r", radius.toString())
            .attr("fill", color)
            .attr("style", "stroke:white;stroke-width:5")
            .attr("transform", "translate(0 0) rotate(0)");
        transformElement(asteroid, _ => initPos);
        let deleted = false;
        const controller = Observable.interval(1000 / FPS);
        controller.subscribe(_ => {
            if (!deleted) {
                transformElement(asteroid, velocityFunc);
                if (collidedWithShip(asteroid, radius)) {
                    killPlayer(ship);
                }
                const bullet = gotShot(asteroid, radius);
                if (bullet) {
                    deleted = true;
                    deleteBullet(bullet);
                    asteroidCount--;
                    if (radius >= 16) {
                        spawnAsteroid(radius / 2, position(asteroid), t => velocityFunc({ x: t.x - asteroidDivergence, y: t.y + asteroidDivergence, rot: 0 }), color);
                        spawnAsteroid(radius / 2, position(asteroid), t => velocityFunc({ x: t.x + asteroidDivergence, y: t.y - asteroidDivergence, rot: 0 }), color);
                    }
                    asteroid.elem.remove();
                }
            }
        });
    }
    let asteroidCount = 0;
    const maxAsteroids = 2;
    const bulletSize = 3;
    const asteroidSpawnInterval = 1000;
    function deleteBullet(bullet) {
        const index = bullets.indexOf(bullet);
        console.log(index);
        if (index >= 0) {
            bullets.splice(bullets.indexOf(bullet), 1);
        }
        bullet.attr("visibility", "hidden");
    }
    const distance = (u, v) => Math.sqrt(Math.abs((v.x - u.x) ** 2 + (v.y - u.y) ** 2));
    const elemType = (elem) => elem.elem.tagName;
    const collision = (elem1, radius1) => (elem2, radius2) => distance(position(elem1), position(elem2)) <= radius1 + radius2;
    const collidedWithShip = collision(g, 10);
    const gotShot = (object, radius) => bullets
        .filter(bullet => collision(object, radius)(bullet, bulletSize))[0];
    Observable.interval(asteroidSpawnInterval)
        .map(_ => ({
        size: Math.random() * 100,
        xPos: (Math.random() * 10000) % SCREEN_MARGIN,
        xVelocity: 4 - Math.random() * 8,
        yVelocity: 4 - Math.random() * 8
    }))
        .filter(rand => rand.size > 8 && rand.size < 45)
        .subscribe(rand => {
        if (asteroidCount < maxAsteroids) {
            asteroidCount++;
            spawnAsteroid(rand.size, { x: rand.xPos, y: SCREEN_MARGIN * -(rand.xPos % 2), rot: 0 }, t => ({ x: rand.xVelocity + t.x, y: rand.yVelocity + t.y, rot: 0 }), `hsl(${Math.abs(rand.xVelocity) * Math.abs(rand.yVelocity) * (360 / 16)}, 100%, 50%)`);
        }
    });
}
if (typeof window != 'undefined')
    window.onload = () => {
        asteroids();
    };
//# sourceMappingURL=asteroids.js.map