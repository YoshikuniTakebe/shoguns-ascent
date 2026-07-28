# Auditoria logica de cartas

Fecha: 2026-07-25

Alcance: 85 efectos unicos, correspondientes a 118 cartas fisicas. Las copias cuyo ID termina en
`-2` comparten efecto y se revisan junto a su carta base.

Estados:

- `OK`: existe una ruta logica completa y no se observa una discrepancia con el texto.
- `PARCIAL`: el efecto existe, pero falta una activacion, eleccion, caso online o interaccion.
- `FALTA`: no existe una implementacion efectiva; puede haber solo texto o log.
- `DUDA`: la implementacion depende de una interpretacion de reglas pendiente de confirmar.

Esta es una auditoria estatica del codigo y sus flujos online/hotseat. `OK` no sustituye una prueba
de partida, pero indica que no se ha encontrado un fallo logico evidente.

## Comprobaciones transversales

1. Los efectos opcionales revisados disponen de eleccion, rechazo y espera online cuando corresponde;
   no quedan cartas conocidas que escojan automaticamente la primera figura, provincia o jugador.
2. Loyalty cubre las ganancias validas de PV de Primavera, Verano y Otono, incluidas las recompensas
   agrupadas de Cosecha, Seppuku y Take Hostage. No se activa en Invierno ni sobre su propio bonus.
3. Way of the Merchant intercepta las ganancias desde la reserva comun, incluidas Cosecha, Koneko,
   Ebisu y recompensas de cartas; no reacciona a transferencias, tratos ni conversiones. Todas las
   monedas obtenidas durante un mismo Harvest forman una unica ganancia por jugador y solo pueden
   activar una vez cada copia del Mercader.
4. Courage, Piety y Kitsune cubren fichas obtenidas en batalla, sin oposicion o por mayor fuerza entre
   aliados. Kitsune se evalua despues de las bajas y exige que la figura siga viva en la provincia.
5. La resolucion interactiva de Seppuku y Take Hostage duplica parte de la logica en store/servidor,
   pero Righteousness, Jikininki, Koneko, Loyalty y las capturas adicionales de Respect estan
   sincronizadas en ambos recorridos.
6. Los efectos `cuando entra en una provincia` se llaman al invocar, mover o reemplazar mediante
   Traicionar. Fujin evalua cada paso por separado, incluida la provincia intermedia.
7. Corregido: los recuentos de Virtudes distintas normalizan copias y Jurojin cuenta a la vez como
   Monster y Virtue en puntuaciones, fuerza y tipos de carta.
8. La comparacion con `Rising Sun Unofficial FAQ.docx` cubre sus 69 apartados. Recruit respeta cada
   Fortaleza fisica incluso cuando varias comparten Provincia, y un Shinto que va a rezar necesita
   una Provincia de invocacion valida antes de abandonar el mapa.
9. Contrastado tambien `Rising_Sun_FAQ_2.0.pdf` (4 paginas). Place no equivale a Summon, Recruit es
   una sola invocacion, los efectos de final de Mandato esperan a su resolucion completa y los
   participantes de una batalla conservan su derecho a pujar aunque pierdan todas sus figuras.
   Las aclaraciones particulares quedan incorporadas en las filas correspondientes.

## Primavera

| Carta | Estado | Resultado de la revision |
|---|---|---|
| Benevolence | OK | Tras gastar monedas en cartas (Train/Ryujin) o Fortalezas (Marshal), permite elegir receptor o rechazar; respeta gasto real, copias y confirmacion sincronizada. |
| Courage | OK | Cada copia concede 2 PV al ganar una ficha en batalla, sin oposicion o por mayor fuerza entre aliados. |
| Daikokuten | OK | Fuerza 8 durante Harvest y fuerza impresa/base fuera de Harvest. |
| Dignity | OK | Cada copia concede 2 PV al invocar realmente un monstruo; enviarlo a reserva no cuenta y su recompensa activa Loyalty. |
| Earth Dragon | OK | Al inicio de batalla su dueno puede omitirlo o elegir una figura no-Daimyo de cada rival y su destino adyacente/maritimo. |
| Fukurokuju | OK | Cuenta como Daimyo y Fortress en fuerza, inmunidades, Recruit, Sengoku y construccion. Puede morir por Seppuku/batalla y Daikaiju lo aplasta como Fortaleza, devolviendolo a la reserva y resolviendo los efectos de muerte. |
| Generosity | OK | Tiene eleccion de receptor, aceptar/rechazar y estado sincronizado. |
| Honesty | OK | Con aliado, concede 2 PV al seleccionar un mandato distinto de Betray. |
| Jinmenju | OK | Solo se activa si ya estaba en juego al comenzar Recruit. Invoca en su provincia, no cuenta como Fortaleza ni permite rezar; Libelula puede usar su excepcion para invocar en cualquier provincia. |
| Jorogumo | OK | Antes de las tacticas, su dueno elige un Bushi/Shinto rival, toma su control durante la batalla y lo devuelve al finalizar. |
| Jurojin | OK | Cuenta como Monster y Virtue; al adquirir cualquier otra Virtue concede 3 monedas y abre confirmacion sincronizada, sin activarse por su propia compra. |
| Komainu | OK | Cuenta como Shinto, usa reserva de monstruo y permite mapa o santuario. Durante Betray puede reemplazar o ser reemplazado indistintamente como Shinto o Monster; Hotei comparte el mismo doble tipo. |
| Kotahi | OK | Recibe la recompensa de Harvest de su provincia cuando tiene la mayor fuerza. |
| Oni of Skulls | OK | Estando solo fuera de batalla conserva Fuerza 1; durante una batalla sigue comparando con todos sus participantes aunque alguno ya no conserve figuras. |
| Oni of Souls | OK | Al ganar una batalla con el monstruo vivo concede 2 PV por cada carta Oni poseida, incluida la propia. |
| Path of the Builder | OK | En cualquier Marshal habilita el flujo normal de construccion de Fortaleza, con eleccion de provincia y pago de coste. |
| Path of the Kannushi | OK | Durante su resolucion de Marshal permite elegir un Shinto propio rezando, el santuario de destino o declinar. |
| Path of the Kenin | OK | Tras invocar permite elegir en cual de sus Fortalezas colocar el Bushi extra o declinar. |
| Path of the Light | OK | Al terminar Recruit permite elegir el santuario para el Shinto extra o declinar. |
| Path of the Lion | OK | Suma 1 a Daimyo y a monstruos que cuentan como Daimyo. |
| Path of the Ninja | OK | Tras invocar, su dueno puede omitirlo o elegir cualquier Bushi rival; pierde Honor y resuelve Mercy/Justice segun la decision y la baja real. |
| Path of the Pacifist | OK | Al inicio de Verano/Otono concede 4 PV si no tiene la mayor cantidad de fichas. |
| Path of the Patron | OK | Tras invocar concede 2 monedas si supera en Honor al menos a dos jugadores. |
| Path of the Salamander | OK | Al inicio de Verano/Otono concede 3 monedas y pierde Honor. |
| Path of the Vassal | OK | Tras ganar cada santuario ofrece pagar 2 monedas por 2 PV, con aceptar/rechazar, copias y espera sincronizada. |
| Path of the Warlord | OK | Concede una moneda por invocacion y una sola vez por turno completo de Recruit. Durante Recruit se resuelve al pulsar Terminar, solo si finalmente se coloco alguna figura; su entrada de registro precede a las activaciones derivadas de Way of the Merchant. |
| Phoenix | OK | Cada muerte efectiva concede 1 PV y lo devuelve; Seppuku y batalla son eventos separados para Loyalty, mientras un Phoenix rehen no puede morir. |
| Piety | OK | Cada copia concede 3 PV y Honor al ganar cualquier ficha con Shinto, Komainu o Hotei presentes. |
| Righteousness | OK | Cada copia concede 1 PV por cada figura propia que muere, incluida la ruta interactiva de Seppuku. Traicion y Camino del Injusto sustituyen figuras, las devuelven a la reserva y no activan esta carta. |
| Way of the Righteous | OK | Toma una moneda de cada jugador con menor Honor al comenzar Guerra. |
| Way of the Shogun | OK | Concede 3 monedas al comenzar Guerra. |

## Verano

| Carta | Estado | Resultado de la revision |
|---|---|---|
| Bishamon | OK | Fuerza 4 con monstruo rival presente y fuerza base en otro caso. |
| Fire Dragon | OK | Antes de las tacticas, su dueno elige la figura valida de cada clan; excluye Daimyo equivalentes y permite Mercy para perdonar a los rivales. |
| Hotei | OK | Cuenta como Shinto, puede rezar y reemplaza Shinto rival con confirmacion sincronizada. |
| Jikininki | OK | Cada baja distinta de Jikininki en su provincia concede 1 PV y pierde Honor; usa la fotografia previa para bajas simultaneas, respeta el orden de Seppuku, activa Loyalty y muestra aviso sincronizado. |
| Justice | OK | Comprueba bajas reales y menor Honor en batalla, Fire Dragon, Way of the Keiri y Path of the Ninja; no se activa cuando Mercy perdona. |
| Koneko | OK | Cualquier muerte efectiva, incluido Seppuku y efectos de cartas, concede 2 monedas y 2 Ronin; los rivales presentes pierden hasta esa cantidad y todos confirman el aviso. |
| Loyalty | OK | Cada copia concede 1 PV por evento valido mientras existe alianza; cubre cartas, tacticas y recompensas, agrupa Cosecha y Take Hostage y no se activa en Invierno ni recursivamente. |
| Mercy | OK | Ofrece una eleccion antes de bajas rivales en batalla, Fire Dragon, Oni of Hate, Way of the Keiri y Path of the Ninja; puede resolverse por provincia en Keiri. |
| Nure-Onna | OK | Tiene decision y movimiento naval previo a batalla, permite ver el mapa y respeta Oni of Plagues. El cruce ofrece el peaje de Path of the Serpent y reanuda la preparacion de batalla tras pagarlo, rechazarlo o quedar bloqueado por falta de monedas. |
| Oni of Blood | OK | Fuerza 2 o 4 segun Honor local, respetando el minimo de Luna. |
| Oni of Souls | OK | Comparte la implementacion completa con la copia de Primavera. |
| Path of Might | OK | Los Bushi ganan +1 de fuerza en provincias con cualquier Oni. |
| Path of Sengoku | OK | Al final de Harvest concede la recompensa de la provincia del Daimyo si no se obtuvo ya. |
| Path of the Favored | OK | Compara el Honor solo entre los jugadores presentes en la provincia. |
| Path of the Monkey | OK | Tras cada invocacion permite rechazar o cobrar 1 moneda a todos los rivales empatados como mas ricos; pierde Honor una sola vez y resuelve copias sucesivas. |
| Path of the Samurai | OK | Al final de Recruit abre una eleccion de provincia valida para cada copia; nunca coloca el Bushi automaticamente y permite declinar. |
| Path of the Serpent | OK | Cada jugador recibe un aviso al comenzar su turno de Marshal si un rival posee la carta. Tras confirmar un movimiento maritimo, cada propietario decide cobrar o perdonar; la transferencia y sus totales se anuncian y confirman de forma sincronizada. |
| Path of the Shadow | OK | Concede 3 monedas al jugar Betray. |
| Patience | OK | Al final de Kami concede 1 PV por copia solo si esta estrictamente por debajo del maximo; un empate en cabeza no cuenta, activa Loyalty y muestra aviso sincronizado. |
| Respect | OK | Tras la primera captura permite elegir otro objetivo valido por cada copia, o terminar; acumula el robo de PV y aplica Loyalty una sola vez al evento Take Hostage. |
| Sincerity | OK | Cada copia concede Honor y 1 PV en cada captura, incluida Sunakake-Baba; varias capturas de Respect activan el efecto por separado y Loyalty agrupa el evento de la ventaja. |
| Sunakake-Baba | OK | En la cola de inicio de Guerra, su dueno puede omitirla o elegir un Bushi/Shinto rival de su provincia para tomarlo como rehen. |
| Way of Bushido | OK | Concede 2 monedas y 2 PV por cada Virtud distinta, normaliza copias e incluye Jurojin. |
| Way of Naginata | OK | Cola por Honor, movimiento opcional de un Bushi a cualquier provincia, confirmar/deshacer e interaccion opcional y sincronizada con Path of the Serpent. |
| Way of the Ashigaru | OK | Cola por Honor, provincia con exactamente una figura, hasta 2 Bushi, confirmar/deshacer y encadenado completo de mejoras opcionales posteriores a la invocacion. |
| Way of the Merchant | OK | Cada copia concede 1 moneda cuando un jugador que era mas rico obtiene monedas de la reserva comun; cubre ingresos, Cosecha, Kami y recompensas de cartas sin dispararse con transferencias, y pausa el flujo con un aviso sincronizado que muestra motivo, premio y total. Harvest usa la riqueza previa al Mandato y agrupa todas sus monedas en una sola activacion por jugador. |
| Way of the Ronin | OK | Concede 2 Ronin al comenzar Guerra. |
| Yurei | OK | Cuenta como Daimyo con fuerza 2, reserva dual y protecciones correspondientes. |

## Otono

| Carta | Estado | Resultado de la revision |
|---|---|---|
| Benten | OK | Al entrar por invocacion, movimiento o reemplazo, su dueno puede omitir el poder o elegir otro monstruo y destino valido; nunca se empuja a si misma y excluye monstruos-Daimyo. |
| Boldness | OK | Concede 4 PV por cada Oni enemigo eliminado en las bajas normales de batalla. |
| Daikaiju | OK | Oceano, colocacion previa a Guerra, deshacer, destruccion y confirmacion sincronizada. No puede ser objetivo de Betray en el oceano y aplasta tambien a Fukurokuju en la provincia elegida. |
| Ebisu | OK | Concede 8 monedas y aviso sincronizado al morir; la ganancia pasa por la reserva comun y puede activar Way of the Merchant. |
| Form of the Beast | OK | Concede 3 PV por carta de Monster. |
| Form of the Demon | OK | Concede 3 PV por Oni. |
| Form of the Dragon | OK | Concede 1 PV por ficha de Guerra. |
| Form of the Fox | OK | Las Fortalezas no cuentan como figura salvo para Tortuga. |
| Form of the Kindred | OK | Concede 3 PV por estacion con alianza, maximo tres estaciones. |
| Form of the Kitsune | OK | Cuenta Fortalezas normales y Fukurokuju. |
| Form of the Phoenix | OK | Cuenta Virtudes distintas e incluye Jurojin. |
| Form of the Tanuki | OK | Jurojin aporta simultaneamente los tipos Monster y Virtue. |
| Kitsune | OK | Concede 6 PV a quien obtiene la ficha en batalla, sin oposicion o entre aliados, solo si Kitsune sigue vivo y presente al terminar la resolucion. |
| Oni of Hate | OK | Al entrar por cualquier motivo, su dueno elige un Bushi/Shinto de cada rival con mas Honor; excluye Daimyo, permite Mercy y se evalua en cada paso de Fujin. |
| Oni of Plagues | OK | Bloquea movimientos normales, Marshal, Fujin, Nure-Onna, Naginata y el desplazamiento forzado por Benten. |
| Oni of Spite | OK | Roba hasta 2 PV a cada rival con mas Honor y Fuerza local mayor que 0 al entrar por cualquier motivo; una Fortaleza sin Fuerza no activa el efecto. Activa Loyalty y se evalua en cada paso de Fujin. |
| Path of the Dragon | OK | Suma 3 a Daimyo y monstruos que cuentan como Daimyo. |
| Path of the Unrighteous | OK | Cada copia agrega una sustitucion opcional de cualquier jugador; permite reemplazar directamente un Shinto rival pulsandolo en un santuario resaltado y devuelve la figura sustituida a su reserva sin activar Righteousness. Los santuarios vacios o solo propios no se resaltan. Si ya no queda un objetivo valido para una sustitucion normal, la sustitucion adicional se habilita aunque el contador general no haya llegado a su ultimo uso. |
| Path of the Spirit | OK | Tras invocar, con mayor Honor, concede 2 monedas y 2 PV. |
| River Dragon | OK | Usa fuerza fija 5 mediante el calculo generico. |
| Sacred Warrior | OK | Suma fuerza por cada carta Virtue e incluye Jurojin. |
| Way of Naginata | OK | Comparte el flujo completo de Verano, incluida la eleccion opcional de Path of the Serpent tras confirmar el movimiento. |
| Way of the Katana | OK | Los Bushi tienen fuerza 2 durante Guerra. |
| Way of the Keiri | OK | Cola por Honor, hasta 2 objetivos por provincia con Daimyo/Yurei/Fukurokuju, deshacer y Mercy independiente por provincia; Justice solo tras bajas reales. |
| Way of the Moneylender | OK | Concede 5 monedas al comenzar Guerra. |
| Way of the Snake | OK | Tras cada Turno Kami, cada propietario decide por orden de Honor si realiza Traicionar; resuelve varios propietarios y recupera despues el turno y resumen Kami correctos. |

## Reglas confirmadas completadas en esta revision

Earth Dragon, Fire Dragon, Jorogumo, Benten, Oni of Hate y Sunakake-Baba ya tienen interfaz de
eleccion sincronizada. La auditoria deja los 85 efectos unicos en estado `OK`. Dignity conserva su
regla correcta de 2 PV por invocar monstruo; Loyalty es la carta que concede PV adicional por cada
evento valido de obtencion de PV. No quedan filas `PARCIAL`, `FALTA` o `DUDA` conocidas.
