# Funcionamiento Completo: Algoritmos Geneticos y Logica Difusa

Este documento explica de forma clara, didactica y sin lenguaje matematico inaccesible como funciona el sistema inteligente desarrollado para disenar rutas de trekking en las lomas de Lima. Esta pensado para que cualquier estudiante, companero de equipo o evaluador comprenda desde los principios mas basicos hasta los detalles mas sofisticados de la arquitectura implementada.

---

## 1. El Problema Real y la Solucion con Inteligencia Artificial

### 1.1 La historia del turista en Lima
Imaginemos a un visitante (nacional o extranjero) que llega a Lima durante la temporada de garua (entre junio y octubre). Ha escuchado que en la periferia de la ciudad el desierto costero florece y se convierte en un oasis verde conocido como las lomas costeras.

El turista quiere organizar una excursion de varios dias, pero se enfrenta a dudas y problemas reales:
- Hay 15 lomas distribuidas desde Ancon en el norte hasta Pachacamac en el sur. ¿Cuales deberia elegir?
- ¿En que orden conviene recorrerlas para no pasar todo el dia sentado en el transporte publico cruzando la ciudad de un extremo a otro?
- Algunas lomas son muy seguras y cuentan con comites locales organizados, pero otras tienen problemas de delincuencia o trochas peligrosas.
- Algunas lomas sufren de sobrecarga de visitantes en fin de semana, lo que degrada el ambiente natural y congestiona los caminos angostos.
- El turista tiene una cantidad fija de dinero (por ejemplo, 60 soles) y un numero exacto de dias libres (por ejemplo, 3 dias).

### 1.2 Por que una computadora comun no puede resolver esto por fuerza bruta
Si una computadora intentara probar todas las combinaciones posibles de rutas de 3 dias eligiendo entre las 15 lomas y considerando todos los ordenes posibles de visita, tendria que evaluar miles de itinerarios. Si el viaje fuera de 5 o 6 dias, el numero de combinaciones posibles superaria los tres millones y medio.

Probar cada combinacion una por una (lo que en computacion se llama "fuerza bruta") tarda demasiado tiempo. Una pagina web o una aplicacion de celular no puede hacer esperar minutos a un usuario. Se necesita un metodo inteligente que encuentre una solucion casi perfecta en menos de un segundo.

### 1.3 El trabajo en equipo de la Inteligencia Artificial
Para resolver este desafio se unen dos ramas complementarias de la Inteligencia Artificial:

1. **La Logica Difusa (El Criterio del Guia Experto):** Razona sobre cosas subjetivas, imprecisas y cualitativas. Responde preguntas como: "¿Este sendero es seguro o peligroso?", "¿Esta loma esta saturada de gente?", "¿Este plan es un paseo suave o una caminata exigente?".
2. **El Algoritmo Genetico (El Estratega Optimizador):** Maneja la combinatoria. Toma las opiniones del guia experto (logica difusa), los limites de dinero y tiempo del usuario, y prueba cientos de itinerarios simultaneamente, mezclando las mejores ideas hasta armar la mejor ruta posible.

---

## 2. Logica Difusa desde Cero: Razonar con Sentido Comun

### 2.1 Que es la Logica Difusa y por que la necesitamos
Las computadoras tradicionales son estrictamente binarias: algo es blanco o negro, 0 o 1, verdadero o falso. Por ejemplo, para una computadora clasica:
- Si fijamos que "seguro" significa una nota mayor a 7.0, entonces una loma con 6.99 seria clasificada como "peligrosa".
- Si fijamos que "barato" es gastar menos de 30 soles, un pasaje de 30.50 soles seria clasificado tajantemente como "caro".

En la vida real, los seres humanos no pensamos asi. Usamos matices y tonos de gris.
- ¿Cuando una taza de cafe deja de estar "tibia" y pasa a estar "caliente"? No hay un grado de temperatura exacto en el que ocurra de golpe; hay una transicion gradual.
- ¿Una persona que mide 1.74 m es alta o mediana? Es un poco de ambas cosas a la vez.

La **Logica Difusa** (creada por Lotfi Zadeh en 1965) le ensena a las computadoras a razonar de esta misma forma humana, permitiendo que un valor pertenezca a varios conceptos simultaneamente con distintos grados de certeza (entre 0% y 100%).

### 2.2 Las cuatro etapas de un Sistema Difuso
Cualquier sistema difuso (conocido como modelo Mamdani) realiza cuatro pasos en serie:

```text
Entrada Real         +-------------------+        Etiquetas Difusas
(Numeros exactos) -->| 1. Fuzzificacion  |------> ("Baja", "Media", "Alta")
                     +-------------------+                 |
                                                           v
                                                  +-------------------+
                                                  | 2. Base de Reglas |
                                                  |  (Sentido comun)  |
                                                  +-------------------+
                                                           |
                                                           v
Salida Real          +-------------------+        +-------------------+
(Nota numerica)   <--|4.Defuzzificacion  |<-------|  3. Inferencia    |
                     +-------------------+        +-------------------+
```

#### Paso 1: Fuzzificacion (Traducir numeros a palabras)
Toma un numero exacto y calcula que tan bien encaja en diferentes adjetivos (conjuntos difusos).
- Si la saturacion de una loma es de 0.45, el sistema no dice simplemente "es media". Calcula: "es 30% baja y 70% media".
- Para hacer esto se dibujan graficos en forma de triangulos o trapecios llamados *funciones de membresia*.

#### Paso 2: Base de Reglas (El conocimiento del experto)
Son oraciones simples de sentido comun estructuradas como:
`SI (condicion 1) Y (condicion 2) ENTONCES (resultado)`
Por ejemplo:
`SI la seguridad es Riesgosa Y el acceso es Dificil ENTONCES el riesgo es Muy Alto.`

#### Paso 3: Motor de Inferencia (Combinar las reglas activadas)
Cuando entra un caso real, varias reglas se disparan al mismo tiempo con diferente fuerza. El motor de inferencia combina todas las reglas que tuvieron razon de activarse y crea una silueta geometrica compuesta con las conclusiones.

#### Paso 4: Defuzzificacion (Volver de las palabras a un numero util)
El sistema toma esa forma geometrica resultante y encuentra su "centro de gravedad" (metodo del centroide). El resultado es un unico numero exacto (por ejemplo: `Riesgo = 3.5 sobre 10`). Este numero ya puede ser procesado matematicamente por el resto del programa.

---

### 2.3 Los Dos Sistemas Difusos de Nuestro Proyecto

Siguiendo las indicaciones del docente, nuestro proyecto no tiene un solo sistema difuso, sino **dos sistemas independientes y especializados**:

| Caracteristica | Sistema Difuso 1: Nivel de Riesgo | Sistema Difuso 2: Nivel de Exigencia |
| :--- | :--- | :--- |
| **¿Donde vive en el proyecto?** | En la **Funcion Fitness** (evaluacion de calidad). | En la **Cadena Genetica** (los genes del individuo). |
| **¿Que evalua?** | El peligro e incomodidad de cada loma individual. | La intensidad del estilo de viaje que busca el plan. |
| **Variables de entrada** | 1. Saturacion turistica<br>2. Seguridad ciudadana<br>3. Accesibilidad del terreno | 1. Horas de caminata<br>2. Cobertura de la loma<br>3. Extension del circuito en km |
| **Variable de salida** | `nivel_riesgo` (de 0.0 a 10.0) | `nivel_exigencia` (de 0.0 a 1.0) |
| **Efecto en el viaje** | Si el riesgo es alto, **resta puntos** al plan. | Si la exigencia encaja con el turista, **suma puntos**. |

#### Detalle del Sistema 1: Nivel de Riesgo de las Lomas
Este sistema reemplazo al antiguo modelo de "calidad" por indicacion directa del profesor.
- **Saturacion turistica (de 0 a 1):** Mide que tan llena de gente esta la loma. ¿Por que alta saturacion es riesgosa? Porque en las lomas de Lima los caminos son estrechos y fragiles. Si va demasiada gente, hay riesgo de caidas, extravios, congestion en zonas sin senal y destruccion del ecosistema por pisoteo de la vegetacion.
- **Seguridad ciudadana (de 0 a 10):** Mide la presencia de vigilancia, antecedentes de incidentes y control vecinal en los accesos.
- **Accesibilidad (de 0 a 10):** Mide que tan complicado es llegar al inicio del sendero (calidad de pistas, transporte formal vs trochas informales).

Si una loma tiene baja seguridad, acceso complicado y saturacion alta, su `nivel_riesgo` saldra cercano a 10 (peligrosa). El optimizador evitara incluirla en la ruta.

#### Detalle del Sistema 2: Nivel de Exigencia de Exploracion
Este sistema responde a la pregunta: "¿Que tan pesada o profunda es la caminata propuesta?".
- **Horas de recorrido (de 1 a 6 horas):** Basado en los datos reales de Lima. Un paseo corto a miradores toma 2 horas; el circuito completo de la Reserva de Lachay toma 6 horas.
- **Cobertura de la zona (de 0.0 a 1.0):** 0.25 significa ir solo al mirador principal; 0.50 recorrer un circuito corto; 1.00 explorar toda el area protegida.
- **Extension del circuito (de 1 a 10 kilometros):** En las lomas de Lima, el circuito mas largo registrado (Lomas de Lucumo) mide alrededor de 7 kilometros. Acotamos el maximo en 10 km para cubrir senderos combinados.

La salida es una escala simple:
- De 0.0 a 0.35: Recorrido **Relajado** (paseo familiar de baja exigencia).
- De 0.35 a 0.70: Recorrido **Moderado** (caminata estandar de senderismo).
- De 0.70 a 1.00: Recorrido **Intenso** (trekking atletico y exploracion completa).

---

## 3. Algoritmos Geneticos desde Cero: La Evolucion al Servicio de las Rutas

### 3.1 La inspiracion de Charles Darwin
En la naturaleza, los seres vivos que tienen caracteristicas favorables para su entorno sobreviven mas tiempo, se reproducen y transmiten esas buenas caracteristicas a sus hijos. Los individuos con caracteristicas desfavorables no logran reproducirse y desaparecen. Con el paso de muchas generaciones, la especie entera mejora y se adapta a su medio.

En computacion, un **Algoritmo Genetico** hace exactamente lo mismo, pero en lugar de animales crea "planes de viaje virtuales":
- Creamos 40 planes de viaje al azar.
- Evaluamos cuales son mejores y cuales son peores.
- Los mejores se combinan entre si (tienen "hijos" que heredan sus mejores paradas).
- De vez en cuando introducimos pequenos cambios al azar (mutaciones).
- Repetimos el ciclo 50 veces (50 generaciones).
- Al final, el plan de viaje que sobrevive es una ruta casi perfecta.

### 3.2 Los terminos basicos de la genetica traducidos a nuestro viaje

| Termino Biologico | En nuestro proyecto significa... | Ejemplo concreto |
| :--- | :--- | :--- |
| **Gen** | Una decision basica e individual dentro del plan. | Visitar `L0` (Lomas del Paraiso) el Dia 1. O caminar `4.2` horas. |
| **Cromosoma (Individuo)** | El plan de viaje completo con todas sus decisiones. | Una cadena completa de 18 datos ordenados. |
| **Poblacion** | El grupo de 40 planes alternativos compitiendo a la vez. | Los 40 itinerarios generados en una generacion. |
| **Generacion** | Una ronda completa de competencia, cruce y reemplazo. | Generacion 1, Generacion 2... hasta la 50. |
| **Fitness (Aptitud)** | La calificacion o nota global que saca un plan de viaje. | Un plan saca 20.87 puntos; otro saca 14.10 puntos. |

---

### 3.3 La Gran Innovacion: El Cromosoma Hibrido de 18 Genes

Un cromosoma normal suele tener un solo tipo de datos (por ejemplo, solo letras o solo numeros). Nuestro proyecto utiliza un **Cromosoma Hibrido**, lo que significa que en una sola cadena combinamos dos tipos de informacion:

```text
Individuo Hibrido (18 genes en total):
Posicion:  0    1    2  |   3    4   ...   14  ||   15   |   16   |   17
         +----+----+----+ +----+----+-----+----+++--------+--------+--------+
Dato:    | L4 | L3 | L0 | | L7 | L1 | ... | L14||  4.2 h |  0.65  | 6.8 km |
         +----+----+----+ +----+----+-----+----+++--------+--------+--------+
Tipo:    <-- PERMUTACION DISCRETA (Lomas) ---->  <-- REALES CONTINUOS --->
Rol:     [ Ventana Activa K ] [Reserva Suplente]  [ Parametros Exigencia ]
```

#### Bloque 1: Las Lomas a Visitar (Genes 0 al 14 - Discretos)
Contiene los 15 codigos de las lomas del catalogo (`L0` a `L14`) ordenados sin repetir ninguno.
- **La Ventana Activa ($K$ lomas):** Si el usuario viaja 3 dias ($K=3$), los tres primeros genes (`L4, L3, L0`) son las lomas titulares que efectivamente se van a visitar cada dia.
- **La Reserva Durmiente (12 lomas suplentes):** Las lomas restantes (`L7, L1, ..., L14`) estan en lista de espera. Si una loma titular resulta ser muy cara o peligrosa, el algoritmo puede intercambiarla por una suplente en la siguiente generacion.

#### Bloque 2: Los Parametros de Exigencia (Genes 15, 16 y 17 - Continuos)
Aqui es donde vive el **Componente 1 de Logica Difusa en la cadena genetica**:
- Gen 15: Las horas que el plan propone caminar (un numero decimal entre 1.0 y 6.0).
- Gen 16: El porcentaje de cobertura de la loma (un numero decimal entre 0.0 y 1.0).
- Gen 17: La distancia de caminata en kilometros (un numero decimal entre 1.0 y 10.0).

El Algoritmo Genetico va modificando estos tres numeros generacion tras generacion. Luego los pasa por el motor difuso de exigencia para ver si el nivel de esfuerzo alcanzado es coherente y armonico con la ruta.

---

### 3.4 Los Operadores Geneticos Explicados con Analogias

¿Como evoluciona la poblacion de planes paso a paso? Mediante cuatro operadores:

#### 1. Seleccion por Torneo (El casting de los mejores)
Imaginen un concurso de talentos:
- Tomamos 3 planes de viaje al azar de la poblacion de 40.
- Comparamos sus notas finales (fitness).
- El plan con la mejor nota gana el torneo y pasa a ser "padre" para reproducirse.
- Hacemos esto dos veces para tener a los dos progenitores (Padre 1 y Padre 2).
- *¿Por que no elegir siempre al mejor de todos directamente?* Porque si solo se reproduce el numero 1, todos los hijos serian casi identicos muy rapido, perdiendo variedad genetica (lo que se llama estancamiento prematuro).

#### 2. Cruce Hibrido (La fusion de ideas)
Queremos que el hijo herede las buenas paradas del Padre 1 y las buenas paradas del Padre 2. Pero como el cromosoma tiene dos tipos de datos, aplicamos dos tecnicas a la vez:
- **Para las lomas (Order Crossover - OX):** Copia un pedazo continuo del Padre 1 (por ejemplo, el primer tramo del viaje) y rellena los dias faltantes con las lomas del Padre 2 respetando el orden, pero saltandose las lomas que ya estaban puestas. Esto garantiza al 100% que **nunca se repita una loma en el mismo viaje**.
- **Para los genes reales (Blend Crossover - BLX-alpha):** Para las horas, la cobertura y los kilometros, el hijo no copia ciegamente el valor de un padre, sino que toma un valor al azar en el rango intermedio entre el Padre 1 y el Padre 2, con un pequeno margen de exploracion adicional hacia afuera ($\alpha = 0.3$).

#### 3. Mutacion Hibrida (El chispazo de creatividad inesperado)
Si solo cruzamos padres existentes, nunca aparecerian ideas totalmente nuevas. La mutacion introduce pequenos cambios aleatorios. Cada vez que nace un hijo, existe un 30% de probabilidad de que sufra una de cuatro mutaciones:
- **Cambio Activo-Reserva (30% de las mutaciones):** Saca a una loma titular y mete a la cancha a una suplente de la reserva. Esto permite explorar destinos del catalogo que antes nadie habia considerado.
- **Cambio Activo-Activo (30% de las mutaciones):** Intercambia el orden de dos dias titulares. Si el itinerario visitaba primero Manchay y luego Paraiso, ahora prueba Paraiso primero y Manchay despues para ver si se gasta menos pasaje.
- **Inversion de Tramo 2-Opt (15% de las mutaciones):** Invierte un pedazo del recorrido para desenredar cruces de caminos absurdos.
- **Mutacion Gaussiana en Genes Reales (25% de las mutaciones):** Le suma o resta una pequena variacion suave (ruido gaussiano) a las horas, a la cobertura o a los kilometros, ajustando el estilo de caminata.

#### 4. Elitismo (El pase directo a la final)
En cada generacion, tomamos a los **2 mejores planes absolutos** de toda la poblacion y los copiamos intactos a la siguiente generacion sin modificarlos. Esto garantiza matematicamente una regla de oro: **la calidad de la mejor ruta encontrada jamas empeorara con el paso del tiempo**.

---

## 4. La Funcion Fitness Explicada en Palabras: La Libreta de Calificaciones

La **Funcion Fitness** (o funcion de aptitud) es el juez supremo del algoritmo. Es una formula matematica que examina un plan de viaje y le pone una **calificacion numerica global**. A mayor nota, mejor es el viaje.

### 4.1 La regla explicada en palabras cotidianas

$$
\mathbf{Calificacion\ del\ Viaje\ (Fitness)} = \text{Beneficio\ Base} + \text{Bono\ por\ Exigencia} - \text{Castigo\ por\ Riesgo} - \text{Cansancio\ de\ Viaje} - \text{Multa\ de\ Presupuesto} - \text{Multa\ de\ Tiempo}
$$

### 4.2 Desglose y explicacion detallada de cada palabra

#### Palabra 1: Beneficio Base (Suma puntos)
- **Que significa:** Cada loma tiene un valor turistico intrinseco por su belleza natural, sus formaciones rocosas o sus restos arqueologicos.
- **Como se calcula:** Se suma la puntuacion base de las lomas titulares que se van a visitar.
- **Por que suma:** Porque el turista viaja para disfrutar de lugares atractivos; a mas lomas hermosas en la ruta, mayor satisfaccion.

#### Palabra 2: Bono por Exigencia (Suma puntos)
- **Que significa:** Es el aporte del **Componente 1 de Logica Difusa**. Mide si el plan ofrece una experiencia de exploracion completa, con buena cobertura de la loma y kilometraje suficiente.
- **Como se calcula:** El motor difuso de exigencia entrega un valor entre 0.0 (muy flojo) y 1.0 (muy completo). Ese valor se multiplica por un peso ($\delta = 2.0$).
- **Por que suma:** Premia los itinerarios que realmente aprovechan el destino y no se quedan solo sentados en la entrada de la loma.

#### Palabra 3: Castigo por Riesgo (Resta puntos)
- **Que significa:** Es el aporte del **Componente 2 de Logica Difusa**. Evalua que tan peligrosas son las lomas elegidas en cuanto a saturacion, inseguridad o accesos accidentados.
- **Como se calcula:** El motor difuso de riesgo le asigna una nota de 0 (segura) a 10 (muy riesgosa) a cada loma titular. Se suman esos riesgos y se multiplican por un factor de penalizacion ($\gamma = 1.5$).
- **Por que resta:** Porque nadie quiere que sus vacaciones terminen en un robo, una caida en una trocha resbalosa o una aglomeracion asfixiante de personas.
- **La modulacion por tolerancia:** El castigo por riesgo se multiplica por un factor de tolerancia: `(1 - 0.3 * exigencia)`. Si el turista tiene un perfil muy exigente y deportista, tolera un 30% mas de riesgo que un turista relajado que busca pasear con ninos o adultos mayores.

#### Palabra 4: Cansancio de Viaje (Resta puntos)
- **Que significa:** Es la distancia geografica total que hay que recorrer para trasladarse.
- **Como se calcula:** Se calcula la distancia real en linea curva sobre la Tierra (usando la formula matematica de Haversine) entre cada loma y la siguiente, y se divide entre 100.
- **Por que resta:** Si visitas una loma en Puente Piedra (norte) el lunes y otra en Villa Maria del Triunfo (sur) el martes, pasaras 4 horas al dia en un microbus respirando humo y cansado. El algoritmo prefiere agrupar lomas cercanas para que disfrutes mas tiempo caminando en la naturaleza.

#### Palabra 5: Multa por Exceso de Presupuesto (Castigo cuadratico)
- **Que significa:** La penalizacion por gastar mas dinero del que el usuario tiene disponible.
- **Como se calcula:**
  - Si el viaje cuesta 35 soles y el usuario tiene 60 soles, **no hay multa (multa = 0)**.
  - Si el viaje cuesta 70 soles y el usuario solo tiene 60 soles, hay un exceso de 10 soles. La multa se calcula elevando al cuadrado el porcentaje de exceso: `25.0 * (10 / 60)^2`.
- **Por que es cuadratica y relativa:** Si te pasas por 1 sol en un presupuesto de 100 soles (1% de exceso), la multa es diminuta y no destruye el plan si las lomas son extraordinarias. Pero si te pasas por 40 soles (40% de exceso), la multa crece de forma brutal y elimina inmediatamente ese plan de la competencia.

#### Palabra 6: Multa por Falta de Tiempo (Castigo cuadratico)
- **Que significa:** La penalizacion por planear mas horas de caminata de las que una persona normal puede realizar fisicamente en el dia.
- **Como se calcula:** Asumimos una jornada saludable de 8 horas utiles al dia. Para un viaje de 3 dias, el limite son 24 horas de caminata. Si las horas estimadas de los senderos superan ese limite, se aplica una multa cuadratica similar a la del presupuesto.
- **Por que es importante:** Evita proponer itinerarios inhumanos que dejen exhausto al visitante.

---

### 4.3 Ejemplo Numerico Paso a Paso (La Historia de Juan)

Pongamos numeros reales a la explicacion para ver como la computadora califica un itinerario.

**El perfil de Juan:**
- Presupuesto maximo: **S/ 60.00**
- Dias libres: **3 dias** ($K = 3$ lomas, tiempo util disponible: $3 \times 8\text{h} = 24\text{ horas}$)
- Ubicacion de partida: Centro de Lima

**El plan de viaje que propone un individuo del algoritmo:**
- Dia 1: `L4` - Lomas de Mangomarca (San Juan de Lurigancho)
- Dia 2: `L3` - Lomas de Manchay (Ate)
- Dia 3: `L0` - Lomas del Paraiso (+ Apu Siqay) (Villa Maria del Triunfo)
- Genes de exigencia en su cromosoma: Horas = `4.2h`, Cobertura = `0.65`, Extension = `6.8 km`.

**Evaluacion paso a paso en la libreta de calificaciones:**

```text
PASO 1: Evaluar la Exigencia (Componente 1 de Logica Difusa)
  Entradas al motor difuso: horas=4.2, cobertura=0.65, extension=6.8 km.
  El sistema difuso evalua las 12 reglas de exigencia y defuzzifica.
  Resultado: Nivel de Exigencia = 0.58 (Moderado-Intenso).

PASO 2: Calcular el Beneficio Base
  Mangomarca (7.0 pts) + Manchay (6.5 pts) + Paraiso (7.5 pts)
  Subtotal Beneficio = +21.00 puntos.

PASO 3: Calcular el Bono por Exigencia
  Multiplicamos el nivel de exigencia por el peso (delta = 2.0):
  Bono = 2.0 * 0.58 = +1.16 puntos.

PASO 4: Evaluar el Riesgo (Componente 2 de Logica Difusa)
  Mangomarca: saturacion=0.15, seguridad=6.5, acceso=7.0 --> Riesgo = 2.8 pts
  Manchay:    saturacion=0.08, seguridad=6.0, acceso=5.5 --> Riesgo = 3.5 pts
  Paraiso:    saturacion=0.15, seguridad=7.5, acceso=6.5 --> Riesgo = 2.2 pts
  Suma de riesgos = 2.8 + 3.5 + 2.2 = 8.5 puntos.

PASO 5: Aplicar el Castigo por Riesgo con Tolerancia
  Factor de tolerancia para exigencia 0.58: 1.0 - (0.58 * 0.3) = 0.826.
  Penalizacion = 1.5 * (8.5 / 10.0) * 0.826 = -1.05 puntos.

PASO 6: Medir el Desplazamiento Geografico
  Distancia entre paradas:
  Mangomarca a Manchay (16.06 km) + Manchay a Paraiso (7.49 km) = 23.55 km.
  Descuento por distancia: 23.55 / 100 = -0.24 puntos.

PASO 7: Comprobar el Bolsillo (Presupuesto)
  Entradas y pasajes: S/ 10 (Mangomarca) + S/ 10 (Manchay) + S/ 15 (Paraiso) = S/ 35.
  Gasto real (S/ 35) <= Presupuesto disponible (S/ 60).
  No gasto de mas --> Multa de dinero = -0.00 puntos.

PASO 8: Comprobar el Reloj (Tiempo de Caminata)
  Horas de senderos: 4.0h + 3.5h + 4.5h = 12.0 horas totales de caminata.
  Tiempo real (12h) <= Tiempo maximo en 3 dias (24h utiles).
  No le falta tiempo --> Multa de tiempo = -0.00 puntos.

CALIFICACION FINAL DEL PLAN (FITNESS):
  Fitness = 21.00 (Beneficio)
          +  1.16 (Bono Exigencia)
          -  1.05 (Castigo Riesgo)
          -  0.24 (Cansancio Distancia)
          -  0.00 (Multa Dinero)
          -  0.00 (Multa Tiempo)
  -----------------------------------------------
  TOTAL   = 20.87 PUNTOS
```

Un plan competidor que intente meter a las Lomas de Lachay (que esta a 105 kilometros al norte de Lima) sufriria una penalizacion de distancia de mas de 1.20 puntos y un pasaje de mas de 45 soles, arrojando una nota final mucho mas baja. Por eso, el algoritmo elegira naturalmente el Plan de Mangomarca, Manchay y Paraiso como ganador.

---

## 5. El Engranaje Completo: Como se Conectan Todos los Modulos

En la ejecucion real del programa, todos los componentes descritos operan sincronizados como un mecanismo de relojeria:

```text
       [ ENTRADA DEL USUARIO: Dias disponibles, Presupuesto maximo ]
                                     |
                                     v
                        [ Mapeo: Dias --> Ventana K ]
                                     |
                                     v
   +-------------------------------------------------------------------+
   |             POBLACION INICIAL DEL ALGORITMO GENETICO              |
   |              (40 Cromosomas Hibridos de 18 genes)                 |
   +-------------------------------------------------------------------+
                                     |
             +-----------------------+-----------------------+
             |                                               |
             v                                               v
    [ Genes 0 al 14: Lomas ]                       [ Genes 15 al 17: Reales ]
             |                                               |
             v                                               v
+--------------------------+                    +--------------------------+
|  SISTEMA DIFUSO 2        |                    |  SISTEMA DIFUSO 1        |
|  NIVEL DE RIESGO         |                    |  NIVEL DE EXIGENCIA      |
|  (Saturacion, Seguridad, |                    |  (Horas, Cobertura,      |
|   Accesibilidad)         |                    |   Extension en km)       |
+--------------------------+                    +--------------------------+
             |                                               |
             | R_riesgo (0 a 10)                             | E_exig (0 a 1)
             |                                               |
             +-----------------------+-----------------------+
                                     |
                                     v
                 +---------------------------------------+
                 |       CALCULO DE LA FUNCION FITNESS   |
                 |      Nota = Beneficio + Bono Exigencia|
                 |             - Riesgo - Distancia      |
                 |             - Multa Dinero - Multa T. |
                 +---------------------------------------+
                                     |
                                     v
                 +---------------------------------------+
                 |         OPERADORES EVOLUTIVOS         |
                 |  - Seleccion por Torneo (k=3)         |
                 |  - Cruce Hibrido (OX + BLX-alpha)     |
                 |  - Mutaciones Compuestas (4 tipos)    |
                 |  - Elitismo (Los 2 mejores avanzan)   |
                 +---------------------------------------+
                                     |
                                     v
                        ¿50 Generaciones completadas?
                                     |
                        +------------+------------+
                        |                         |
                       NO                        SI
                        |                         |
            (Repetir siguiente gen.)              v
                                      [ RUTA OPTIMA SELECCIONADA ]
                                      - Secuencia exacta de paradas
                                      - Nivel de exigencia optimo
                                      - Riesgo minimizado y dentro
                                        del presupuesto del usuario
```

---

## 6. Guia Rapida para la Sustentacion Oral (Preguntas Tipicas del Jurado)

Si un profesor o jurado evaluador hace preguntas tecnicas sobre el diseno, aqui estan las respuestas claras y fundamentadas:

### Pregunta 1: ¿Por que separaron la Logica Difusa en dos sistemas en vez de hacer uno solo gigante de 6 o 9 variables?
**Respuesta:** Por un principio fundamental de ingenieria llamado la *Maldicion de la Dimensionalidad*. Si hicieramos un solo sistema difuso con 6 variables de 3 terminos cada una, necesitariamos $3^6 = 729$ reglas para cubrir todos los casos; con 9 variables serian casi 20,000 reglas. Eso vuelve al sistema inmanejable y causa fallos matematicos en la computadora. Al separar en dos sistemas pequenos de 3 variables cada uno, solo necesitamos entre 12 y 16 reglas por motor, logrando una cobertura del 100% que es verificable y robusta.

### Pregunta 2: ¿Por que cambiaron "Calidad de las Lomas" por "Nivel de Riesgo"?
**Respuesta:** Porque en la literatura cientifica de planificacion y optimizacion de rutas de transporte y senderismo, los factores de peligro (aglomeracion, trochas peligrosas, zonas sin vigilancia) se modelan formalmente como penalizaciones de riesgo que el optimizador debe minimizar. El atractivo o belleza de la loma es una cualidad intrinseca que se maneja como beneficio base.

### Pregunta 3: ¿Por que eliminaron la variable de "Clima" del sistema difuso?
**Respuesta:** Porque en Lima las lomas solo se visitan en temporada de garua (junio a octubre), periodo en el que todas comparten un clima similar de neblina y verdor. El clima no genera un riesgo operativo para el senderista como si lo hacen la delincuencia (seguridad), el camino agreste (accesibilidad) y el apiñamiento de turistas en caminos estrechos (saturacion).

### Pregunta 4: ¿Por que el cromosoma tiene 18 genes y no 15?
**Respuesta:** Porque adoptamos una representacion hibrida. Los primeros 15 genes forman una permutacion estricta de las lomas para resolver el problema combinatorio sin duplicados. Los ultimos 3 genes son valores reales continuos que representan el estilo de exploracion (horas, cobertura, kilometros). Esto permite que el Algoritmo Genetico optimice de forma simultanea **que lomas visitar**, **en que orden recorrerlas** y **con que nivel de exigencia realizarlas**.

### Pregunta 5: ¿Que pasa si el usuario solo tiene un dia disponible?
**Respuesta:** Cuando el usuario dispone de 1 solo dia ($K=1$), no existe un problema de ordenamiento ni rutas que comparar. El sistema activa un atajo inteligente: filtra las lomas que no pasen del presupuesto y selecciona directamente la que tenga menor riesgo difuso y mayor beneficio, respondiendo en menos de 0.05 segundos sin gastar tiempo innecesario ejecutando el algoritmo genetico.
