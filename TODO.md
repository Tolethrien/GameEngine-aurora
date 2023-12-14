moje mysli i pomysły:

# Myśli

- czy dałoby sie cos osiagnac robiac wpierw lightmap z po prostu punktmai gdzie sa swiatla na ekranie i przekazywac to jako uniform i cos z tym wizualnie robic, np cieniować pixele w zaleznosci od dystansu do punktu ewentualnie fejk 3d swiatel(obliczyc najblizsze swiatlo,potem sprawdzic w jakim kierunku od niego znajduje sie sprite i tak go zacieniować by swiatlo padalo na niego tylko z tego kierunku a przeciwny bedzie ciemny)
- zrobic tak by swiatla tez byly renderowane kiedy jest scena cala tak by swiatlo wchodzace za budynek ucinalo sie, jak to robi bloom

# TODO

- Batcher: zrobić renderowanie od góry w dół, czyli wpierw renderowac sie beda obiekty najblizej ekrany by nie potrzebnie rysowac cos co i tak zaraz bedzie zasłonięte innym obiektem(depth bufforing)

- renderowanie tekstu. Tekst mus isie dac renderowac bezposrendio w grze jak i na UI

- UI caly system oparty nie na kamerze a na procentach przełożonych na gpu space

- dodac zwiekszenie swiatla jako opcje dla dramatycznego efektu bialego? (see composite shader)

- clipping
