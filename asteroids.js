"use strict";
function asteroids() {
    const FPS = 60, SCREEN_MARGIN = 655;
    const DEFAULTS = {
        shipSpeed: 5,
        bulletColor: "#fff",
        bulletSpeed: 8,
        bulletLifeFrames: 50,
        asteroidDivergence: 0.8,
        defaultAsteroidColor: "#000",
        minAsteroidRadius: 8,
        maxAsteroidRadius: 45,
        maxAsteroidSpeed: 4,
        biggestAsteroidConsidered: 100,
        maxAsteroids: 4,
        bulletSize: 3,
        asteroidSpawnInterval: 1000,
        shipHitboxRadius: 10,
        starHitboxRadius: 15,
        starEdgePadding: 10,
        starSpawnRate: 1500,
        starSpawnChance: 3
    };
    const rad = (deg) => deg * (Math.PI / 180);
    let gameOver = false;
    let asteroidCount = 0;
    let score = 0;
    let powerLevel = 0;
    const bullets = [];
    const svg = document.getElementById("canvas");
    const g = new Elem(svg, 'g')
        .attr("transform", "translate(300 300) rotate(0)");
    const ship = new Elem(svg, 'polygon', g.elem)
        .attr("points", "-15,20 15,20 0,-20")
        .attr("style", "fill:black;stroke:white;stroke-width:5");
    const scoreElement = new Elem(svg, "text")
        .attr("x", "10px")
        .attr("y", "30px")
        .attr("fill", "#fff")
        .attr("style", "font: bold 24px sans-serif;");
    scoreElement.elem.innerHTML = "Score:";
    const powerMeter = new Elem(svg, "text")
        .attr("x", "10px")
        .attr("y", "55px")
        .attr("fill", "#fff")
        .attr("style", "font: bold 24px sans-serif;");
    powerMeter.elem.innerHTML = "Power:";
    const mapTransform = (f) => (t) => ({ x: f(t.x), y: f(t.y), rot: f(t.rot) });
    const floorTransform = mapTransform(Math.floor);
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
        x: ((t.x + (Math.sin(rad(t.rot)) * DEFAULTS.shipSpeed))),
        y: (t.y - (Math.cos(rad(t.rot)) * DEFAULTS.shipSpeed)),
        rot: t.rot
    }), backward = (t) => ({
        x: ((t.x - (Math.sin(rad(t.rot)) * DEFAULTS.shipSpeed))),
        y: (t.y + (Math.cos(rad(t.rot)) * DEFAULTS.shipSpeed)),
        rot: t.rot
    }), right = (t) => ({ x: t.x, y: t.y, rot: (t.rot + DEFAULTS.shipSpeed) }), left = (t) => ({ x: t.x, y: t.y, rot: (t.rot - DEFAULTS.shipSpeed) });
    controlElement(g, controls, k => k == "w", forward);
    controlElement(g, controls, k => k == "a", left);
    controlElement(g, controls, k => k == "s", backward);
    controlElement(g, controls, k => k == "d", right);
    function shootFrom(elem, bulletTimeout, velocityFunc, startingPos) {
        if (startingPos === undefined)
            startingPos = position(elem);
        const bullet = new Elem(svg, 'circle')
            .attr("r", DEFAULTS.bulletSize.toString())
            .attr("fill", DEFAULTS.bulletColor)
            .attr("transform", "translate(0 0) rotate(0)");
        let liveBullet = true;
        bullets.push(bullet);
        const bulletDeath = Observable.interval(bulletTimeout);
        bulletDeath.subscribe(_ => {
            if (liveBullet)
                deleteBullet(bullet);
            liveBullet = false;
        });
        transformElement(bullet, _ => startingPos);
        Observable.interval(1000 / FPS)
            .takeUntil(bulletDeath)
            .subscribe(_ => transformElement(bullet, velocityFunc));
    }
    function shootManyFrom(elem, bulletTimeout, velocityFunc, startPosFunctions) {
        const elemOrigin = position(elem);
        startPosFunctions
            .map(f => f(elemOrigin))
            .forEach(mappedPos => shootFrom(elem, bulletTimeout, velocityFunc, mappedPos));
    }
    const bulletMovement = (t) => ({
        x: ((t.x + (Math.sin(rad(t.rot)) * DEFAULTS.bulletSpeed))),
        y: (t.y - (Math.cos(rad(t.rot)) * DEFAULTS.bulletSpeed)),
        rot: t.rot
    });
    function generatePointArc(arcDegrees, numPoints) {
        const deviationDegrees = (part) => ((part - 1) * arcDegrees) / (numPoints - 1) - (arcDegrees / 2);
        return Array(numPoints)
            .fill(0)
            .reduce((acc, e) => acc.concat([e + acc.length + 1]), [])
            .map(deviationDegrees)
            .map((radians) => (t) => ({ x: t.x, y: t.y, rot: t.rot + radians }));
    }
    const powerLevelStages = [
        [],
        generatePointArc(20, 2),
        generatePointArc(110, 3),
        generatePointArc(90, 4),
        generatePointArc(90, 5),
        generatePointArc(75, 6),
        generatePointArc(75, 8),
    ];
    function shootAtPowerLevel(elem, bulletTimeout, bulletMovement, powerLevel) {
        if (powerLevel == 0) {
            shootFrom(g, bulletTimeout, bulletMovement);
        }
        else {
            shootManyFrom(g, bulletTimeout, bulletMovement, powerLevelStages[powerLevel]);
        }
    }
    controls
        .filter(k => k == " ")
        .subscribe(_ => {
        shootAtPowerLevel(g, DEFAULTS.bulletLifeFrames * 1000 / FPS, bulletMovement, powerLevel);
    });
    function deleteBullet(bullet) {
        const index = bullets.indexOf(bullet);
        if (index >= 0)
            bullets.splice(bullets.indexOf(bullet), 1);
        bullet.attr("visibility", "hidden");
    }
    function killPlayer(ship) {
        if (!gameOver) {
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
    }
    function updatePowerLevel(f) {
        const transformation = f(powerLevel);
        powerLevel = transformation >= powerLevelStages.length ?
            powerLevelStages.length - 1 : transformation;
        powerMeter.elem.innerHTML = "Power: " + (powerLevel + 1);
    }
    updatePowerLevel(_ => powerLevel);
    function spawnStar(initPos, velocityFunc) {
        const powerStar = new Elem(svg, 'polygon')
            .attr("points", "10 -5, 15 5, 25 10, 15 15, 10 25, 5 15, -5 10, 5 5")
            .attr("style", "fill:#880;stroke:white;stroke-width:5")
            .attr("transform", "translate(0 0) rotate(0)");
        transformElement(powerStar, _ => initPos);
        let alive = true;
        const killStar = () => { alive = false; powerStar.attr("visibility", "hidden"); };
        Observable.interval(1000 / FPS)
            .filter(() => alive)
            .subscribe(_ => {
            transformElement(powerStar, velocityFunc);
            if (position(powerStar).x >= SCREEN_MARGIN - DEFAULTS.starEdgePadding)
                killStar();
            if (collidedWithShip(powerStar, DEFAULTS.starHitboxRadius) && !gameOver) {
                killStar();
                updatePowerLevel(n => n + 1);
                updateScore(starScoreModifier);
            }
        });
    }
    const starVelocity = (t) => ({ x: t.x + 6, y: t.y, rot: t.rot + 5 });
    const starScoreModifier = (score) => score * 1.1;
    Observable.interval(DEFAULTS.starSpawnRate)
        .filter(_ => (Math.floor(Math.random() * 100) % DEFAULTS.starSpawnChance == 0))
        .map(_ => (Math.random() * 10000) % SCREEN_MARGIN)
        .subscribe(newY => {
        spawnStar({ x: 0, y: newY, rot: 0 }, starVelocity);
    });
    const asteroidScoreFunc = (radius) => (oldScore) => (oldScore + Math.ceil(radius) * 100);
    function spawnAsteroid(radius, initPos, velocityFunc, color) {
        color = color === undefined ? DEFAULTS.defaultAsteroidColor : color;
        const asteroid = new Elem(svg, 'circle')
            .attr("r", radius.toString())
            .attr("fill", color)
            .attr("style", "stroke:white;stroke-width:5")
            .attr("transform", "translate(0 0) rotate(0)");
        transformElement(asteroid, _ => initPos);
        let deleted = false;
        Observable.interval(1000 / FPS)
            .filter(() => !deleted)
            .subscribe(_ => {
            transformElement(asteroid, velocityFunc);
            if (collidedWithShip(asteroid, radius))
                killPlayer(ship);
            const bullet = gotShot(asteroid, radius);
            if (bullet) {
                deleted = true;
                deleteBullet(bullet);
                asteroidCount--;
                updateScore(asteroidScoreFunc(radius));
                color = color === undefined ? DEFAULTS.defaultAsteroidColor : color;
                if (radius >= DEFAULTS.minAsteroidRadius * 2) {
                    spawnAsteroid(radius / 2, position(asteroid), t => velocityFunc({ x: t.x - DEFAULTS.asteroidDivergence, y: t.y + DEFAULTS.asteroidDivergence, rot: 0 }), color);
                    spawnAsteroid(radius / 2, position(asteroid), t => velocityFunc({ x: t.x + DEFAULTS.asteroidDivergence, y: t.y - DEFAULTS.asteroidDivergence, rot: 0 }), color);
                }
                asteroid.elem.remove();
            }
        });
    }
    const distance = (u, v) => Math.sqrt(Math.abs((v.x - u.x) ** 2 + (v.y - u.y) ** 2));
    const collision = (elem1, radius1) => (elem2, radius2) => distance(position(elem1), position(elem2)) <= radius1 + radius2;
    const collidedWithShip = collision(g, DEFAULTS.shipHitboxRadius);
    const gotShot = (object, radius) => bullets
        .filter(bullet => collision(object, radius)(bullet, DEFAULTS.bulletSize))[0];
    Observable.interval(DEFAULTS.asteroidSpawnInterval)
        .map(_ => ({
        size: Math.random() * DEFAULTS.biggestAsteroidConsidered,
        yPos: (Math.random() * 10000) % SCREEN_MARGIN,
        xVelocity: DEFAULTS.maxAsteroidSpeed - Math.random() * DEFAULTS.maxAsteroidSpeed * 2,
        yVelocity: DEFAULTS.maxAsteroidSpeed - Math.random() * DEFAULTS.maxAsteroidSpeed * 2
    }))
        .filter(rand => rand.size > DEFAULTS.minAsteroidRadius && rand.size < DEFAULTS.maxAsteroidRadius)
        .subscribe(rand => {
        if (asteroidCount < DEFAULTS.maxAsteroids) {
            asteroidCount++;
            spawnAsteroid(rand.size, { x: SCREEN_MARGIN, y: rand.yPos, rot: 0 }, t => ({ x: rand.xVelocity + t.x, y: rand.yVelocity + t.y, rot: 0 }), `hsl(${Math.abs(rand.xVelocity) * Math.abs(rand.yVelocity) * (360 / (DEFAULTS.maxAsteroidSpeed ** 2))}, 100%, 50%)`);
        }
    });
    function updateScore(f) {
        const newScore = Math.round(f(score));
        scoreElement.elem.innerHTML = "Score: " + newScore;
        score = newScore;
    }
    updateScore(_ => score);
}
if (typeof window != 'undefined')
    window.onload = () => {
        asteroids();
    };
//# sourceMappingURL=asteroids.js.map