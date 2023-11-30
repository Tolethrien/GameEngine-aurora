moje mysli i pomysły:

# Myśli

- czy dałoby sie cos osiagnac robiac wpierw lightmap z po prostu punktmai gdzie sa swiatla na ekranie i przekazywac to jako uniform i cos z tym wizualnie robic, np cieniować pixele w zaleznosci od dystansu do punktu ewentualnie fejk 3d swiatel(obliczyc najblizsze swiatlo,potem sprawdzic w jakim kierunku od niego znajduje sie sprite i tak go zacieniować by swiatlo padalo na niego tylko z tego kierunku a przeciwny bedzie ciemny)

# TODO

- Batcher: zrobić renderowanie od góry w dół, czyli wpierw renderowac sie beda obiekty najblizej ekrany by nie potrzebnie rysowac cos co i tak zaraz bedzie zasłonięte innym obiektem

- zrobic by api nie potrzebowalo tekstury na start by sie odpalic, np tworzyc texture2d maksylanej wielkosci i pozwalac od niej zapisywac w locie i odczytywac konkretn wyciecia jej

# Pomysły

- swiatlo globalne
- swiatlo dynamiczne
- bloom

  /\*\*

* plan: swiatlo musi miec:
* blobalne swiatło
* miejscowe światło
* bloom
*
* universal shader i pipeline
* compute shader dla gainsow wydajnosci
*
* universal shader module, gdzie bedziesz mogl wybierac kilka efektow
* LUT
* \*/
