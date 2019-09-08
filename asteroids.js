"use strict";
function asteroids() {
    const FPS = 60, SCREEN_MARGIN = 650;
    const svg = document.getElementById("canvas");
    let g = new Elem(svg, 'g')
        .attr("transform", "translate(300 300) rotate(0)");
    let ship = new Elem(svg, 'polygon', g.elem)
        .attr("points", "-15,20 15,20 0,-20")
        .attr("style", "fill:lime;stroke:purple;stroke-width:1");
    function transformElement(elem, f) {
        const current = currentPosition(elem);
        const result = floorTransform(f(current));
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
            velocity.subscribe(_ => transformElement(g, t => keepInBounds(f(t), SCREEN_MARGIN)));
        });
    }
    function currentPosition(elem) {
        const parts = elem.attr("transform")
            .match(/translate\((-*[0-9]+\.*[0-9]*)\s(-*[0-9]+\.*[0-9]*)\)\srotate\((-*[0-9]+\.*[0-9]*)\)/)
            .splice(1)
            .map(n => parseInt(n));
        return { x: parts[0], y: parts[1], rot: parts[2] };
    }
    const controls = Observable
        .fromEvent(document, "keypress")
        .filter(event => !event.repeat)
        .map(event => event.key);
    const rad = (deg) => deg * (Math.PI / 180);
    const floorTransform = (t) => ({ x: Math.floor(t.x), y: Math.floor(t.y), rot: Math.floor(t.rot) });
    function keepInBounds(t, bound) {
        const reorient = (n) => n < 0 ? (n % bound) + bound : n % bound;
        return { x: reorient(t.x), y: reorient(t.y), rot: t.rot };
    }
    const forward = (t) => ({ x: ((t.x + (Math.sin(rad(t.rot)) * 5))), y: (t.y - (Math.cos(rad(t.rot)) * 5)), rot: t.rot }), backward = (t) => ({ x: ((t.x - (Math.sin(rad(t.rot)) * 5))), y: (t.y + (Math.cos(rad(t.rot)) * 5)), rot: t.rot }), right = (t) => ({ x: t.x, y: t.y, rot: (t.rot + 5) }), left = (t) => ({ x: t.x, y: t.y, rot: (t.rot - 5) });
    const shoot = controls
        .filter(k => k == " ")
        .subscribe(_ => {
        const bullet = new Elem(svg, 'circle')
            .attr("r", "3")
            .attr("fill", "#fff")
            .attr("transform", "translate(0 0) rotate(0)");
        const deleteBullet = Observable.interval(5000);
        deleteBullet.subscribe(_ => bullet.attr("visibility", "hidden"));
        const shipPos = currentPosition(g);
        transformElement(bullet, _ => shipPos);
        const velocity = Observable.interval(1000 / FPS)
            .takeUntil(deleteBullet)
            .subscribe(_ => transformElement(bullet, (t) => ({
            x: ((t.x + (Math.sin(rad(t.rot)) * 8))),
            y: (t.y - (Math.cos(rad(t.rot)) * 8)),
            rot: t.rot
        })));
    });
    controlElement(g, controls, k => k == "w", forward);
    controlElement(g, controls, k => k == "a", left);
    controlElement(g, controls, k => k == "s", backward);
    controlElement(g, controls, k => k == "d", right);
    controls
        .subscribe(console.log);
}
if (typeof window != 'undefined')
    window.onload = () => {
        asteroids();
    };
//# sourceMappingURL=asteroids.js.map