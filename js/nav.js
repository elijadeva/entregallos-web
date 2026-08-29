// Navegación compartida: menú móvil, dropdown de juegos, sombra del header al scrollear.
var navToggle = document.getElementById('navToggle');
var navLinks = document.getElementById('navLinks');

function closeMobileMenu(){
  navLinks.classList.remove('open');
  navToggle.setAttribute('aria-expanded','false');
  navToggle.textContent = '☰';
  document.body.classList.remove('menu-open');
}

navToggle.addEventListener('click', function(){
  var isOpen = navLinks.classList.toggle('open');
  navToggle.setAttribute('aria-expanded', isOpen);
  navToggle.textContent = isOpen ? '✕' : '☰';
  document.body.classList.toggle('menu-open', isOpen);
});

var gamesDropdown = document.getElementById('gamesDropdown');
var gamesToggle = document.getElementById('gamesToggle');
gamesToggle.addEventListener('click', function(e){
  e.preventDefault();
  var isOpen = gamesDropdown.classList.toggle('open');
  gamesToggle.setAttribute('aria-expanded', isOpen);
});
document.addEventListener('click', function(e){
  if(!gamesDropdown.contains(e.target)){
    gamesDropdown.classList.remove('open');
    gamesToggle.setAttribute('aria-expanded','false');
  }
});

document.querySelectorAll('.nav-links a').forEach(function(a){
  a.addEventListener('click', function(){
    closeMobileMenu();
    gamesDropdown.classList.remove('open');
    gamesToggle.setAttribute('aria-expanded','false');
  });
});

var topbar = document.querySelector('.topbar');
window.addEventListener('scroll', function(){
  topbar.classList.toggle('scrolled', window.scrollY > 8);
}, {passive:true});
