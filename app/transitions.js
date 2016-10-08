export default function(){
  this.transition(
    this.fromRoute('index'),
    this.use('toLeft'),
    this.reverse('toRight')
  );

  this.transition(
    this.fromRoute('pizza'),
    this.toRoute('burrito'),
    this.use('funFade'),
    this.reverse('funFade')
  );
}
