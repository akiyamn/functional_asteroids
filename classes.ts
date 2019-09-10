// //TYPES
// interface Transform {
//     x: number;
//     y: number;
//     rot: number;
// }
//
// type TransFunc = (t: Transform) => Transform
//
// class Bullet {
//
//     static bulletList:Bullet[] = [];
//     static defaultRadius:number = 3;
//     static defaultColor:string = "#fff";
//
//     private element:Elem;
//     private radius:number;
//
//     constructor(svg:HTMLElement, startingPos:Transform, velocityFunc: TransFunc, bulletTimeout: number, radius?:number, color?:string){
//         if (radius === undefined) radius = Bullet.defaultRadius;
//         if (color === undefined) color = Bullet.defaultColor;
//         this.element = new Elem(svg, 'circle')
//             .attr("r", radius.toString())
//             .attr("fill", color!)
//             .attr("transform", "translate(0 0) rotate(0)");
//         Bullet.bulletList.push(this);
//         this.radius = radius;
//         this.observerSetup(startingPos, velocityFunc, bulletTimeout);
//     }
//
//     private observerSetup(start:Transform, velcoityFunc:TransFunc, timeout:number) : void{
//         const bulletDeath = Observable.interval(timeout);
//         bulletDeath.subscribe(_ => this.kill());
//         transformElement(this.element, () => start);
//         const velocity = Observable.interval(1000/60)
//             .takeUntil(bulletDeath)
//             .subscribe(_ => transformElement(bullet, velocityFunc))
//     }
//
//     kill() {
//         const index = Bullet.bulletList.indexOf(this)
//     }
// }