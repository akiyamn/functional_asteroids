"use strict";
function asteroids() {
    const FPS = 60, SCREEN_MARGIN = 650;
    const shipSpeed = 5, bulletColor = "#fff", bulletSpeed = 8, bulletLifeFrames = 90, asteroidDivergence = 0.8, defaultAsteroidColor = "#000", minAsteroidRadius = 8, maxAsteroidRadius = 45, maxAsteroidSpeed = 4, biggestAsteroidConsidered = 100, maxAsteroids = 2, bulletSize = 3, asteroidSpawnInterval = 1000, shipHitboxRadius = 10;
    const rad = (deg) => deg * (Math.PI / 180);
    let gameOver = false;
    let asteroidCount = 0;
    const bullets = [];
    const svg = document.getElementById("canvas");
    const g = new Elem(svg, 'g')
        .attr("transform", "translate(300 300) rotate(0)");
    const ship = new Elem(svg, 'polygon', g.elem)
        .attr("points", "-15,20 15,20 0,-20")
        .attr("style", "fill:black;stroke:white;stroke-width:5");
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
    const forward = (t) => ({
        x: ((t.x + (Math.sin(rad(t.rot)) * shipSpeed))),
        y: (t.y - (Math.cos(rad(t.rot)) * shipSpeed)),
        rot: t.rot
    }), backward = (t) => ({
        x: ((t.x - (Math.sin(rad(t.rot)) * shipSpeed))),
        y: (t.y + (Math.cos(rad(t.rot)) * shipSpeed)),
        rot: t.rot
    }), right = (t) => ({ x: t.x, y: t.y, rot: (t.rot + shipSpeed) }), left = (t) => ({ x: t.x, y: t.y, rot: (t.rot - shipSpeed) });
    controlElement(g, controls, k => k == "w", forward);
    controlElement(g, controls, k => k == "a", left);
    controlElement(g, controls, k => k == "s", backward);
    controlElement(g, controls, k => k == "d", right);
    function shootFrom(elem, bulletTimeout, velocityFunc) {
        const bullet = new Elem(svg, 'circle')
            .attr("r", bulletSize.toString())
            .attr("fill", bulletColor)
            .attr("transform", "translate(0 0) rotate(0)");
        let liveBullet = true;
        bullets.push(bullet);
        const bulletDeath = Observable.interval(bulletTimeout);
        bulletDeath.subscribe(_ => {
            if (liveBullet)
                deleteBullet(bullet);
            liveBullet = false;
        });
        const startingPos = position(elem);
        transformElement(bullet, _ => startingPos);
        Observable.interval(1000 / FPS)
            .takeUntil(bulletDeath)
            .subscribe(_ => transformElement(bullet, velocityFunc));
    }
    const bulletMovement = (t) => ({
        x: ((t.x + (Math.sin(rad(t.rot)) * bulletSpeed))),
        y: (t.y - (Math.cos(rad(t.rot)) * bulletSpeed)),
        rot: t.rot
    });
    controls
        .filter(k => k == " ")
        .subscribe(_ => {
        shootFrom(g, bulletLifeFrames * 1000 / FPS, bulletMovement);
    });
    function deleteBullet(bullet) {
        const index = bullets.indexOf(bullet);
        if (index >= 0)
            bullets.splice(bullets.indexOf(bullet), 1);
        bullet.attr("visibility", "hidden");
    }
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
    function spawnAsteroid(radius, initPos, velocityFunc, color) {
        color = color === undefined ? defaultAsteroidColor : color;
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
                if (collidedWithShip(asteroid, radius))
                    killPlayer(ship);
                const bullet = gotShot(asteroid, radius);
                if (bullet) {
                    deleted = true;
                    deleteBullet(bullet);
                    asteroidCount--;
                    color = color === undefined ? defaultAsteroidColor : color;
                    if (radius >= minAsteroidRadius * 2) {
                        spawnAsteroid(radius / 2, position(asteroid), t => velocityFunc({ x: t.x - asteroidDivergence, y: t.y + asteroidDivergence, rot: 0 }), color);
                        spawnAsteroid(radius / 2, position(asteroid), t => velocityFunc({ x: t.x + asteroidDivergence, y: t.y - asteroidDivergence, rot: 0 }), color);
                    }
                    asteroid.elem.remove();
                }
            }
        });
    }
    const distance = (u, v) => Math.sqrt(Math.abs((v.x - u.x) ** 2 + (v.y - u.y) ** 2));
    const collision = (elem1, radius1) => (elem2, radius2) => distance(position(elem1), position(elem2)) <= radius1 + radius2;
    const collidedWithShip = collision(g, shipHitboxRadius);
    const gotShot = (object, radius) => bullets
        .filter(bullet => collision(object, radius)(bullet, bulletSize))[0];
    Observable.interval(asteroidSpawnInterval)
        .map(_ => ({
        size: Math.random() * biggestAsteroidConsidered,
        yPos: (Math.random() * 10000) % SCREEN_MARGIN,
        xVelocity: maxAsteroidSpeed - Math.random() * maxAsteroidSpeed * 2,
        yVelocity: maxAsteroidSpeed - Math.random() * maxAsteroidSpeed * 2
    }))
        .filter(rand => rand.size > minAsteroidRadius && rand.size < maxAsteroidRadius)
        .subscribe(rand => {
        if (asteroidCount < maxAsteroids) {
            asteroidCount++;
            spawnAsteroid(rand.size, { x: SCREEN_MARGIN, y: rand.yPos, rot: 0 }, t => ({ x: rand.xVelocity + t.x, y: rand.yVelocity + t.y, rot: 0 }), `hsl(${Math.abs(rand.xVelocity) * Math.abs(rand.yVelocity) * (360 / (maxAsteroidSpeed ** 2))}, 100%, 50%)`);
        }
    });
}
if (typeof window != 'undefined')
    window.onload = () => {
        asteroids();
    };
//# sourceMappingURL=asteroids.js.map