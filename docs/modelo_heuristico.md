# Documentacion técnica del modulo heuristico: Algoritmo Genetico

## 1. Introduccion y Formulacion del Problema

El problema de diseno de rutas ecoturisticas en Lima Metropolitana consiste en seleccionar y ordenar un subconjunto de $K$ destinos a partir de un catalogo de $N = 15$ lomas costeras, satisfaciendo multiples objetivos contrapuestos y restricciones estrictas:

1. **Maximizar la satisfaccion y adaptabilidad turistica:** Recompensar el beneficio base de los atractivos visitados y sintonizar la ruta con el nivel de exigencia de exploracion del turista, evaluado mediante el primer sistema difuso Mamdani integrado en la cadena genetica ($E_{\text{exig}} \in [0.0, 1.0]$).
2. **Minimizar el riesgo operacional:** Penalizar las lomas que presenten condiciones desfavorables de saturacion turistica, seguridad y accesibilidad, evaluadas mediante el segundo sistema difuso Mamdani en la funcion fitness ($R_{\text{riesgo}} \in [0.0, 10.0]$).
3. **Minimizar los traslados geograficos:** Minimizar la distancia acumulada en kilometros entre paradas consecutivas o desplazamientos radiales, evitando recorridos dispersos por la ciudad.
4. **Respetar el presupuesto del usuario:** La sumatoria de costos de transporte local y entradas no debe exceder el presupuesto total asignado por el turista.
5. **Respetar la disponibilidad de tiempo:** Las horas estimadas de caminata en los senderos deben ser compatibles con las jornadas utiles de los dias disponibles.

### 1.1 Clasificacion Computacional

Este problema pertenece a la clase de problemas de optimizacion combinatoria **NP-hard**. Especificamente, corresponde a una variante del **Orienteering Problem (OP)** o **Selective Traveling Salesperson Problem (STSP)** con variables mixtas (discretas y continuas) bajo restricciones presupuestales y temporales.

A diferencia del clasico Problema del Agente Viajero (TSP) donde se deben visitar obligatoriamente todos los nodos ($K = N$), en este problema se debe resolver de manera conjunta:

- Un problema de **seleccion de subconjunto (Knapsack / Mochila)**: Que $K$ lomas visitar de las $N=15$ disponibles para maximizar el beneficio neto dentro del presupuesto.
- Un problema de **ordenamiento de secuencia (TSP / Permutacion)**: En que orden especifico recorrer las $K$ lomas elegidas para minimizar la distancia geografica total de traslado.
- Un problema de **optimizacion continua de parametros de exploracion**: Que valores de horas de recorrido, cobertura de zona y extension de circuito se ajustan mejor al perfil deseado mediante logica difusa en el cromosoma.

### 1.2 Dimension del Espacio de Busqueda

El numero total de rutas ordenadas posibles de longitud $K$ a partir de $N = 15$ destinos viene dado por las variaciones sin repeticion:

$$
P(N, K) = \frac{N!}{(N - K)!}
$$


| Valor de K (Destinos) | Dias Equivalentes | Numero de Rutas Posibles $P(15, K)$ | Complejidad de Fuerza Bruta |
| :---------------------: | :-----------------: | :-----------------------------------: | :--------------------------- |
| $K = 1$               | 1 a 4 dias        | 15                                  | Inmediato                   |
| $K = 2$               | 5 a 8 dias        | 210                                 | Pequeño                     |
| $K = 3$               | 9 a 12 dias       | 2,730                               | Moderado                    |
| $K = 4$               | 13 a 16 dias      | 32,760                              | Elevado                     |
| $K = 5$               | 17 a 20 dias      | 360,360                             | Muy Elevado                 |
| $K = 6$               | 21 a 24 dias      | 3,603,600                           | Inviable en tiempo real     |
| $K = 8$               | Cota maxima       | 259,459,200                         | Espacio combinatorio masivo |


Adicionalmente, al incorporar 3 variables continuas reales en el cromosoma, el espacio total de busqueda se transforma en un espacio hibrido continuo-combinatorio infinito. El **Algoritmo Genetico (AG)** proporciona un mecanismo de busqueda estocastica guiada capaz de converger a soluciones de alta calidad en milisegundos.

## 2. Estructura Cromosomica Hibrida y Espacio de Soluciones

### 2.1 El Gen (Tipos de Informacion)

El cromosoma utiliza dos tipos de genes segun su rol en la solucion:

| Elemento del Gen | Tipo de Informacion | Dominio | Equivalente en el Proyecto | Ejemplo Concreto |
| :--- | :--- | :--- | :--- | :--- |
| **Genes 0 a 14** | Discreto (Alelos de lomas) | $\{L_0, \dots, L_{14}\}$ | Paradas de lomas y reserva durmiente | `L0` en Posicion 0 (Dia 1) |
| **Gen 15** | Real continuo | $[1.0, 6.0]$ | Horas dedicadas de recorrido | $4.2$ horas |
| **Gen 16** | Real continuo | $[0.0, 1.0]$ | Cobertura porcentual de la zona | $0.65$ ($65\%$ de cobertura) |
| **Gen 17** | Real continuo | $[1.0, 10.0]$ | Extension del circuito en km | $6.8$ kilometros |

### 2.2 El Cromosoma Hibrido (18 Genes: 15 de Permutacion + 3 Reales)

Para resolver conjuntamente la seleccion de destinos, el ordenamiento de paradas y la intensidad de la experiencia, se implementa un **cromosoma hibrido de 18 genes**:

1. **Bloque Discreto de Permutacion (Genes 0 al 14):**
   - **Ventana Activa ($K$ lomas titulares):** Las primeras $K$ lomas que el turista efectivamente recorrera (`individuo[:K]`).
   - **Reserva Genetica Durmiente ($15 - K$ intrones):** Lomas suplentes en lista de espera (`individuo[K:15]`). Garantizan la validez matematica del operador Order Crossover (OX) sin riesgo de alelos duplicados o faltantes.
2. **Bloque Continuo de Exigencia Difusa (Genes 15 al 17):**
   - Corresponde al **Componente 1 de Logica Difusa en la cadena genetica**.
   - Estos 3 genes alimentan el motor de inferencia Mamdani de exigencia para calcular de forma dinamica el `nivel_exigencia` de la solucion.

**Tabla del Cromosoma Hibrido para un viaje de 3 dias ($K = 3$):**

| Posicion (Locus) | Codigo o Valor | Tipo | Descripcion / Destino | Rol en el Cromosoma | ¿Evaluado? |
| :---: | :---: | :---: | :--- | :--- | :---: |
| **0** | `L0` | Discreto | Lomas del Paraiso (+ Apu Siqay) | **Dia 1 (Titular)** | **Si** |
| **1** | `L3` | Discreto | Lomas de Manchay | **Dia 2 (Titular)** | **Si** |
| **2** | `L4` | Discreto | Lomas de Mangomarca | **Dia 3 (Titular)** | **Si** |
| **3** | `L7` | Discreto | Lomas de Lucumo | Suplente 1 (Reserva) | No |
| **4** | `L1` | Discreto | Lomas de Carabayllo 2 | Suplente 2 (Reserva) | No |
| **...** | ... | ... | ... | ... | No |
| **14** | `L14` | Discreto | La Loma Amarilla | Suplente 12 (Reserva) | No |
| **15** | `4.2` | Real | Horas de recorrido [1, 6] | **Gen Exigencia (Horas)** | **Si** |
| **16** | `0.65` | Real | Cobertura de zona [0, 1] | **Gen Exigencia (Cobertura)**| **Si** |
| **17** | `6.8` | Real | Extension circuito [1, 10] km | **Gen Exigencia (Extension)**| **Si** |

```text
Locus:        0         1         2     |     3       ...     14    ||   15    |   16    |   17
         +---------+---------+---------+ +---------+-------+---------++---------+---------+---------+
Alelos:  |   L4    |   L3    |   L0    | |   L7    |  ...  |   L14   ||   4.2   |  0.65   |   6.8   |
         +---------+---------+---------+ +---------+-------+---------++---------+---------+---------+
Estado:  <----- VENTANA ACTIVA K ----->   <-- RESERVA DURMIENTE --->  <-- GENES REALES EXIGENCIA ->
Destino: Mangomarca  Manchay   Paraiso      Lucumo       Loma Amar.   Horas      Cob.      Ext.
```

### 2.3 La Poblacion (Los 40 Planes Hibridos Compitiendo)

La poblacion es el conjunto de **40 itinerarios alternativos** generados al inicio de forma aleatoria:

| Individuo | Itinerario Activo ($K = 3$) | Lomas en Reserva (Suplentes) | Genes Reales [H, C, E] | Diagnostico Estimado | Calidad Inicial |
| :---: | :--- | :--- | :---: | :--- | :--- |
| **Plan 1** | Paraiso -> Manchay -> Mangomarca | Lucumo, Amancaes, Ancon, ... | [4.2, 0.65, 6.8] | Lomas balanceadas, exigencia moderada, costo bajo. | **Alta** |
| **Plan 2** | Lucumo -> Ancon -> Lachay | Paraiso, Carabayllo, Primavera, ... | [5.8, 0.90, 9.5] | Muy distantes (>120 km), alta exigencia pero inviable en costo. | **Baja** |
| **Plan 3** | Carabayllo -> Primavera -> Amancaes | Lucumo, Manchay, Paraiso, ... | [2.5, 0.35, 3.2] | Concentradas en Lima Norte, exigencia relajada, costo medio. | **Media** |
| **...** | *(37 planes adicionales generados)* | ... | ... | ... | ... |

### 2.4 Restriccion de Unicidad y Atajo para K = 1

- **Unicidad:** La porcion de permutacion (genes 0 al 14) garantiza matematicamente cero destinos repetidos en la ventana activa ($\forall i \neq j < K \implies g_i \neq g_j$).
- **Atajo Determinista ($K = 1$):** Cuando el usuario dispone de 1 solo dia, se omite el proceso evolutivo combinatorio. El sistema filtra las lomas en presupuesto y selecciona aquella con menor nivel de riesgo difuso y mayor beneficio base, resolviendo en tiempo $O(N)$.

---

## 3. La Funcion Fitness (Aptitud) Explicada en Palabras

Antes de la formulacion matematica formal, la funcion de aptitud representa la **calificacion global del viaje** segun la siguiente regla en palabras cotidianas:

$$
\mathbf{Nota\ del\ Viaje\ (Fitness)} = (\text{Beneficio\ Base\ de\ las\ Lomas}) + (\text{Bonificacion\ por\ Exigencia\ de\ Exploracion}) - (\text{Penalizacion\ por\ Riesgo\ de\ las\ Lomas}) - (\text{Desgaste\ por\ Traslados}) - (\text{Multa\ por\ Exceso\ de\ Presupuesto}) - (\text{Multa\ por\ Falta\ de\ Tiempo})
$$

### Tabla de Criterios: ¿Que suma puntos y que resta puntos?

| Criterio Evaluado | Efecto en la Nota | ¿Como se calcula en palabras? | Justificacion Practica |
| :--- | :---: | :--- | :--- |
| **Beneficio Base de las Lomas** | **Suma (+)** | Suma de los puntajes base intrinsecos de las $K$ lomas titulares. | El turista busca lomas atractivas con alto valor paisajistico y patrimonial. |
| **Bonificacion por Exigencia** | **Suma (+)** | Nivel de exigencia difuso ($E_{\text{exig}} \in [0.0, 1.0]$) multiplicado por el peso $\delta = 2.0$. | Premia una exploracion profunda y coherente; el AG evoluciona la intensidad optima. |
| **Penalizacion por Riesgo de Lomas** | **Resta (-)** | Suma de los niveles de riesgo difuso ($R_{\text{riesgo}} \in [0.0, 10.0]$) de las lomas titulares, modulada por la tolerancia al riesgo del turista. | Evita destinos con sobreafluencia/saturacion, baja seguridad o accesos peligrosos. |
| **Desgaste por Traslados** | **Resta (-)** | Kilometros acumulados de viaje entre lomas consecutivas dividido entre 100 y escalado por $\beta = 1.0$. | Viajar horas en bus agota al turista y resta tiempo util de caminata. |
| **Multa por Exceso de Presupuesto** | **Castiga (-)** | Si gastas menos o igual que tu presupuesto, multa = 0. Si te pasas, multa relativa al cuadrado escalada por $\lambda_1 = 25.0$. | El viaje debe ser pagable; si sobrepasa el dinero del usuario, pierde viabilidad. |
| **Multa por Falta de Tiempo** | **Castiga (-)** | Si las caminatas caben en la jornada util (8h/dia), multa = 0. Si faltan horas, multa relativa al cuadrado escalada por $\lambda_2 = 25.0$. | Las jornadas deben ser realizables sin sobreexigir fisicamente al usuario. |

### Ejemplo Numerico Paso a Paso

Supongamos que un usuario dispone de **S/ 60.00 de presupuesto** y **3 dias** ($K=3$), alojado en el Centro de Lima.

Evaluamos el **Plan 1** con cromosoma hibrido:
- Permutacion: `L4: Mangomarca` -> `L3: Manchay` -> `L0: Paraiso`
- Genes reales: `horas = 4.2h`, `cobertura = 0.65` ($65\%$), `extension = 6.8 km`

| Paso | Concepto Evaluado | Datos y Calculo en Palabras | Puntos Aportados |
| :---: | :--- | :--- | :---: |
| **1** | **Componente 1: Nivel de Exigencia** | Entradas: 4.2h, 65% cob., 6.8 km. El motor Mamdani evalua las 12 reglas de exigencia y defuzzifica por centroide $\implies E_{\text{exig}} = 0.58$ (Exigencia Moderada-Intensa). | — |
| **2** | **Beneficio Base de las Lomas** | Mangomarca (7.0 pts) + Manchay (6.5 pts) + Paraiso (7.5 pts) | **+21.00 pts** |
| **3** | **Bonificacion por Exigencia** | Multiplicar el peso $\delta = 2.0$ por el nivel de exigencia $0.58$: $2.0 \times 0.58$ | **+1.16 pts** |
| **4** | **Componente 2: Riesgo Difuso por Loma** | L4: Mangomarca (sat 0.15, seg 6.5, acc 7.0) $\implies R = 2.8$<br>L3: Manchay (sat 0.08, seg 6.0, acc 5.5) $\implies R = 3.5$<br>L0: Paraiso (sat 0.15, seg 7.5, acc 6.5) $\implies R = 2.2$<br>Riesgo acumulado = $2.8 + 3.5 + 2.2 = 8.5$ pts | — |
| **5** | **Penalizacion por Riesgo con Tolerancia** | Factor de tolerancia: $1.0 - (0.58 \times 0.3) = 0.826$.<br>Penalizacion: $\gamma \times (8.5 / 10.0) \times 0.826 = 1.5 \times 0.85 \times 0.826$ | **-1.05 pts** |
| **6** | **Traslados en bus** | Mangomarca a Manchay (16.06 km) + Manchay a Paraiso (7.49 km) = 23.55 km.<br>Restar $\beta \times (23.55 / 100)$ con $\beta = 1.0$ | **-0.24 pts** |
| **7** | **Gasto del Viaje** | Entradas y pasajes: S/ 10 + S/ 10 + S/ 15 = S/ 35.<br>Gasto S/ 35 vs Limite S/ 60 $\implies$ Exceso = S/ 0 $\implies$ Multa = 0 | **-0.00 pts** (Sin multa) |
| **8** | **Horas de Caminata** | Senderos: 4.0h + 3.5h + 4.5h = 12.0 horas totales.<br>12h caben en 3 dias (24h utiles) $\implies$ Exceso = 0h $\implies$ Multa = 0 | **-0.00 pts** (Sin multa) |
| **FINAL** | **Calificacion Total (Fitness)** | **Fitness = 21.00 + 1.16 - 1.05 - 0.24 - 0.00 - 0.00** | **20.87 puntos** |

---

## 4. Formulacion Matematica Rigurosa del Fitness

La funcion de adaptacion global integra formalmente los dos componentes difusos, el costo fisico y las restricciones duras cuadraticas:

$$
\boxed{F(x) = \sum_{j=1}^{K} B(d_j) \;+\; \delta \cdot E_{\text{exig}}(x) \;-\; \gamma \cdot \left(\frac{\sum_{j=1}^{K} R_{\text{riesgo}}(d_j)}{10}\right) \cdot (1 - 0.3 \cdot E_{\text{exig}}(x)) \;-\; \beta \cdot \left(\frac{\text{DistanciaTotal}(x)}{100}\right) \;-\; \Omega_{\text{presupuesto}}^{\text{rel}} \;-\; \Omega_{\text{tiempo}}^{\text{rel}} \;-\; \Omega_{\text{unicidad}}}
$$

### 4.1 Termino 1: Beneficio Base de los Destinos ($B(d_j)$)

$$
F_{\text{base}}(x) = \sum_{j=1}^{K} B(d_j)
$$

- $B(d_j) \in [1.0, 10.0]$ es el valor de atractivo intrinseco de la loma (biodiversidad, formaciones rocosas, valor arqueologico y vistas panoramicas) sin intervencion difusa.
- Recompensa al itinerario por incorporar paradas de alto interes turistico.

### 4.2 Termino 2: Bonificacion por Exigencia de Exploracion ($\delta \cdot E_{\text{exig}}$) — Componente 1

$$
F_{\text{exig}}(x) = \delta \cdot E_{\text{exig}}(x_{15}, x_{16}, x_{17})
$$

- $E_{\text{exig}} \in [0.0, 1.0]$ es el nivel de exigencia obtenido mediante el **primer motor difuso Mamdani** a partir de los 3 genes reales del cromosoma:
  - $x_{15}$: Horas de recorrido $\in [1.0, 6.0]$
  - $x_{16}$: Cobertura de la zona $\in [0.0, 1.0]$
  - $x_{17}$: Extension del circuito $\in [1.0, 10.0]$ km
- Con $\delta = 2.0$, este termino premia las soluciones que logran una exploracion profunda y estructurada.

### 4.3 Termino 3: Penalizacion por Riesgo Operacional de las Lomas ($R_{\text{riesgo}}$) — Componente 2

$$
\Omega_{\text{riesgo}}(x) = \gamma \cdot \left( \frac{\sum_{j=1}^{K} R_{\text{riesgo}}(d_j)}{10} \right) \cdot \left(1 - 0.3 \cdot E_{\text{exig}}(x)\right)
$$

- $R_{\text{riesgo}}(d_j) \in [0.0, 10.0]$ es el score de riesgo inferido por el **segundo motor difuso Mamdani** para cada destino a partir de 3 variables de entrada:
  - **Saturacion turistica:** Escala $[0.0, 1.0]$. A mayor saturacion, mayor riesgo de congestionamiento y deterioro ambiental.
  - **Seguridad ciudadana:** Escala $[0.0, 10.0]$. A menor seguridad percibida, mayor riesgo.
  - **Accesibilidad cualitativa:** Escala $[0.0, 10.0]$. A menor accesibilidad del terreno y transporte, mayor riesgo.
- **Factor de modulacion por tolerancia:** $(1 - 0.3 \cdot E_{\text{exig}})$. Modela que un turista con perfil de alta exigencia ($E_{\text{exig}} \to 1.0$) presenta mayor disposicion a tolerar condiciones desafiantes, reduciendo ligeramente el castigo por riesgo; mientras que un turista relajado ($E_{\text{exig}} \to 0.0$) es castigado con mayor rigor si se le asignan lomas riesgosas.
- Con $\gamma = 1.5$ y division entre 10 para normalizar el riesgo medio por loma.

### 4.4 Termino 4: Costo por Desplazamiento Geografico

$$
f_{\text{distancia}}(x) = \beta \cdot \left( \frac{\text{DistanciaTotal}(x)}{100} \right)
$$

Donde $\beta = 1.0$ y el factor de escala $100$ normaliza la magnitud de los kilometros frente a la escala de los puntajes base.

La distancia total entre paradas consecutivas se calcula mediante la **formula de Haversine**:

$$
\text{DistanciaTotal}(x) = \sum_{j=0}^{K-2} \text{dist}_{\text{haversine}}(x[j], x[j+1])
$$

Si la ruta contiene un unico destino ($K = 1$), $\text{DistanciaTotal}(x) = 0.0\text{ km}$.

#### Formula de Haversine:
Dados dos puntos $P_1(\phi_1, \lambda_1)$ y $P_2(\phi_2, \lambda_2)$ en coordenadas decimales (latitud y longitud):

$$
\Delta \phi = \phi_2 - \phi_1, \quad \Delta \lambda = \lambda_2 - \lambda_1
$$

$$
a = \sin^2\left(\frac{\Delta \phi}{2}\right) + \cos(\phi_1) \cdot \cos(\phi_2) \cdot \sin^2\left(\frac{\Delta \lambda}{2}\right)
$$

$$
c = 2 \cdot \text{atan2}\left(\sqrt{a}, \sqrt{1 - a}\right)
$$

$$
d = R \cdot c \quad \text{con } R = 6371.0\text{ km (radio medio de la Tierra)}
$$

### 4.5 Termino 5: Penalizacion Relativa Adimensional Presupuestal

$$
\Omega_{\text{presupuesto}}^{\text{rel}} = \lambda_1 \cdot \left( \frac{\max\left(0,\; \sum_{j=1}^{K} \text{CostoEstimado}(d_j) - \text{Presupuesto}\right)}{\text{Presupuesto}} \right)^2
$$

- Con $\lambda_1 = 25.0$.
- **Resolucion del Fitness Scaling Problem:** Al dividir el exceso entre el presupuesto, la metrica se vuelve adimensional porcentual. Un exceso del 20% genera $(0.20)^2 \times 25.0 = 1.0$ punto de castigo, permitiendo que la seleccion por torneo distinga rutas con buenos atractivos sin que excesos monetarios marginales destruyan la poblacion.

### 4.6 Termino 6: Penalizacion Relativa Adimensional Temporal

$$
\Omega_{\text{tiempo}}^{\text{rel}} = \lambda_2 \cdot \left( \frac{\max\left(0,\; \sum_{j=1}^{K} \text{HorasEstimadas}(d_j) - (\text{DiasDisponibles} \times 8.0)\right)}{\text{DiasDisponibles} \times 8.0} \right)^2
$$

- Con $\lambda_2 = 25.0$, normalizado sobre la jornada util disponible ($8.0$ horas por dia).

### 4.7 Termino 7: Penalizacion Estricta de Unicidad

$$
\Omega_{\text{unicidad}} = 1000.0 \cdot (K - |\text{set}(x_{0..K-1})|)
$$

- Actua como barrera de seguridad matematica con un castigo destructivo de 1000 puntos por cada destino duplicado en caso de anomalia en los operadores.

## 5. Operadores Geneticos Adaptados a Cromosomas Hibridos

Dado que el cromosoma combina un bloque discreto de permutacion (genes 0 al 14) y un bloque continuo de variables reales (genes 15 al 17), se implementan operadores geneticos hibridos especializados:

```text
+---------------------------------------------------------------------------------+
|                  CICLO EVOLUTIVO DEL ALGORITMO GENETICO HIBRIDO                 |
+---------------------------------------------------------------------------------+
|  1. Inicializacion: P cromosomas hibridos (15 permutacion + 3 genes reales)     |
|  2. Evaluacion: Computo de Fitness F(x) con Riesgo Difuso + Exigencia Difusa    |
|  3. Elitismo: Preservacion intacta de los E=2 mejores individuos hibridos       |
|  4. Seleccion: Torneo estocastico con k_torneo = 3                              |
|  5. Cruce Hibrido (prob = 0.85):                                                |
|     - Segmento Discreto (0-14): Order Crossover (OX) para permutaciones         |
|     - Segmento Continuo (15-17): Blend Crossover (BLX-alpha, alpha = 0.3)       |
|  6. Mutacion Hibrida Compuesta (prob = 0.30):                                   |
|     - Swap Activo-Reserva (30%): Sustitucion de destino en ventana K            |
|     - Swap Activo-Activo (30%): Reordenamiento de paradas activas               |
|     - Inversion 2-Opt (15%): Desenredo de tramos de ruta                        |
|     - Mutacion Gaussiana (25%): Perturbacion N(0, sigma^2) en genes reales      |
|  7. Verificacion de Criterio de Parada (G_max generaciones alcanzadas)          |
+---------------------------------------------------------------------------------+
```

### 5.1 Seleccion por Torneo ($k_{\text{torneo}} = 3$)

Para seleccionar cada progenitor:

1. Se eligen 3 individuos al azar de la poblacion con distribucion uniforme.
2. Se compara su aptitud global $F(x)$ calculada con la funcion multiobjetivo reformulada.
3. El individuo con mayor fitness es seleccionado como progenitor.

- **Justificacion:** El torneo con $k=3$ ofrece una presion selectiva intermedia ideal: favorece a los mejores individuos sin descartar prematuramente la diversidad genetica en ambos bloques (discreto y continuo).

### 5.2 Cruce Hibrido: Order Crossover (OX) + Blend Crossover (BLX-$\alpha$)

Al estar compuesto por dos tipos de datos, el cruce opera de manera diferenciada e independiente sobre cada segmento del cromosoma:

1. **Segmento Discreto de Permutacion (Genes 0 al 14): Order Crossover (OX)**
   - Se eligen dos puntos de corte aleatorios $0 \le i_1 < i_2 < 15$.
   - El descendiente hereda el subsegmento continuo del Padre 1 entre $i_1$ e $i_2$.
   - Los alelos restantes se copian en el orden relativo que aparecen en el Padre 2 desde $i_2 + 1$ de forma circular, omitiendo los ya presentes.
   - **Garantia:** La permutacion de 15 lomas se mantiene estrictamente valida y sin duplicados.

2. **Segmento Continuo de Exigencia (Genes 15 al 17): Blend Crossover (BLX-$\alpha$)**
   - Para cada gen real $j \in \{15, 16, 17\}$, sean $p_{1,j}$ y $p_{2,j}$ los valores de los progenitores, con $c_{\min} = \min(p_{1,j}, p_{2,j})$, $c_{\max} = \max(p_{1,j}, p_{2,j})$ y distancia $d = c_{\max} - c_{\min}$.
   - El gen del descendiente se genera aleatoriamente en el intervalo expandido:
     $$h_j \sim U\left(c_{\min} - \alpha \cdot d,\; c_{\max} + \alpha \cdot d\right)$$
   - Con $\alpha = 0.3$. El valor resultante se acota estrictamente dentro del rango de definicion de la variable (horas $\in [1.0, 6.0]$, cobertura $\in [0.0, 1.0]$, extension $\in [1.0, 10.0]$).
   - **Garantia:** Permite la exploracion continua alrededor del espacio de soluciones de los padres sin perder estabilidad numerica.

### 5.3 Mutaciones Hibridas Compuestas

Cada vez que un individuo es seleccionado para mutar (con probabilidad $p_m = 0.30$), se aplica una de las siguientes cuatro estrategias segun su distribucion de probabilidad relativa:

#### A. Swap Activo-Reserva (Sustitucion de Loma — Probabilidad relativa 30%)
- **Mecanica:** Se elige una posicion activa $i < K$ y una posicion de reserva $j \in [K, 14]$ y se intercambian sus alelos: $\text{Hijo}[i], \text{Hijo}[j] = \text{Hijo}[j], \text{Hijo}[i]$.
- **Objetivo:** Exploracion de catalogo. Introduce una loma no visitada en la ventana activa, permitiendo descubrir destinos con menor nivel de riesgo o costo mas economico.

#### B. Swap Activo-Activo (Reordenamiento de Secuencia — Probabilidad relativa 30%)
- **Mecanica:** Se eligen dos posiciones dentro de la ventana activa $i_1, i_2 < K$ y se intercambian sus posiciones en la ruta.
- **Objetivo:** Explotacion de distancia. Busca permutaciones de las mismas lomas que reduzcan la distancia total de traslado Haversine.

#### C. Inversion 2-Opt Activa (Eliminacion de Cruces — Probabilidad relativa 15%)
- **Mecanica:** Se eligen dos indices dentro de la ventana activa $i_1 < i_2 < K$ y se invierte el subsegmento: $\text{Hijo}[i_1:i_2+1] = \text{reversed}(\text{Hijo}[i_1:i_2+1])$.
- **Objetivo:** Optimizador local para desenredar cruces geograficos entre paradas consecutivas.

#### D. Mutacion Gaussiana en Genes Reales (Ajuste de Exigencia — Probabilidad relativa 25%)
- **Mecanica:** Se elige aleatoriamente uno de los tres genes reales ($x_{15}, x_{16}$ o $x_{17}$) y se le suma una perturbacion estocastica proveniente de una distribucion normal:
  $$x_j' = x_j + N(0, \sigma_j^2)$$
  Donde $\sigma_j$ se calibra al $10\%$ del rango util de la variable ($\sigma_{\text{horas}} = 0.5$, $\sigma_{\text{cob}} = 0.1$, $\sigma_{\text{ext}} = 0.9$). El valor perturbado se trunca al rango valido del gen.
- **Objetivo:** Exploracion y afinamiento continuo del perfil de exigencia que mejor armonice con las lomas seleccionadas y la tolerancia al riesgo.

### 5.4 Elitismo ($E = 2$)

Los 2 mejores individuos con mayor aptitud de cada generacion se copian intactos (con sus 18 genes completos) a la siguiente generacion sin pasar por cruce ni mutacion. Esto garantiza formalmente que:

$$
F(\text{Mejor}_{g+1}) \ge F(\text{Mejor}_{g}) \quad \forall g \ge 1
$$

El fitness de la mejor solucion encontrada nunca decae a lo largo de las generaciones.

---

## 6. Desglose y Explicacion del Codigo Fuente

A continuacion se explica la estructura y metodos de `modules/genetic_algorithm.py` adaptados al modelo hibrido:

### 6.1 Funcion `distancia_haversine(lat1, lon1, lat2, lon2)`

- Realiza la transformacion a radianes mediante `math.radians`.
- Implementa la ecuacion del semiverseno con proteccion ante errores de redondeo de punto flotante (`max(0.0, 1.0 - a)`).
- Si las coordenadas origen y destino son identicas, retorna `0.0` inmediatamente para optimizar llamadas redundantes.

### 6.2 Clase `LomasGeneticOptimizer`

Representa el motor evolutivo encapsulado.

#### Constructor `__init__(...)`

- Configura las colecciones del problema: catalogo de destinos, diccionario por ID (`destinos_dict`), conjunto de IDs totales.
- Recibe las instancias de los dos motores difusos: `RiesgoFuzzySystem` (para evaluar destinos) y `ExigenciaFuzzySystem` (para evaluar genes del cromosoma).
- Normaliza los parametros de ejecucion: acota $K$ al rango $[1, 15]$, valida tipos de datos para presupuesto y dias, y asegura que la poblacion minima sea viable.
- Permite inyeccion de semilla pseudoaleatoria (`semilla`) para pruebas unitarias deterministas.

#### Metodo `_generar_individuo()`

- Genera la parte de permutacion: `random.sample(todos_ids, 15)`.
- Genera la parte continua: `horas` en $[1.0, 6.0]$, `cobertura` en $[0.0, 1.0]$, `extension` en $[1.0, 10.0]$.
- Retorna la concatenacion de 18 elementos: `permutacion + [horas, cobertura, extension]`.

#### Metodo `calcular_distancia_ruta(ruta)`

- Itera sobre los pares consecutivos $(x[i], x[i+1])$ de la ventana activa y acumula la distancia Haversine de cada tramo extrayendo las coordenadas desde `self.destinos_dict`.
- Si `len(ruta) <= 1`, retorna `0.0 km`.

#### Metodo `fitness(individuo)`

- Desempaqueta el individuo hibrido: `ruta_activa = individuo[:self.k]` y `genes_exigencia = individuo[15:18]`.
- Evalua el **Componente 1**: pasa `genes_exigencia` a `ExigenciaFuzzySystem` obteniendo `nivel_exigencia` ($E_{\text{exig}}$).
- Evalua el **Componente 2**: consulta o calcula el score de `RiesgoFuzzySystem` ($R_{\text{riesgo}}$) para cada loma activa.
- Computa los terminos de beneficio base, bonificacion por exigencia, penalizacion por riesgo modulada por tolerancia, distancia Haversine, y barreras cuadraticas relativas de presupuesto y tiempo.

#### Metodo `_crossover_hibrido(padre1, padre2)`

- Aplica **Order Crossover (OX)** sobre `padre1[:15]` y `padre2[:15]`.
- Aplica **Blend Crossover (BLX-$\alpha$)** sobre los genes reales `padre1[15:18]` y `padre2[15:18]`.
- Ensambla y retorna los dos descendientes hibridos resultantes.

#### Metodo `_mutar(individuo)`

- Selecciona aleatoriamente una de las 4 estrategias:
  - Swap Activo-Reserva (30%)
  - Swap Activo-Activo (30%)
  - Inversion 2-Opt (15%)
  - Mutacion Gaussiana (25%): aplica perturbacion normal sobre uno de los genes reales y lo clampa a su rango valido.

#### Metodo `_dibujar_grafica_ascii(historial, ancho=40, alto=8)`

- Muestrea el historial de fitness a lo largo de las generaciones y proyecta los valores en una matriz de caracteres ASCII.
- Utiliza `*` para puntos clave, `|` para lineas verticales y `-` para ejes, permitiendo visualizar la convergencia directamente en terminales Windows/Linux sin dependencias graficas pesadas.

#### Metodo `optimizar(verbose=False)`

- Orquesta el bucle evolutivo de $G$ generaciones.
- Registra en cada iteracion: mejor fitness, fitness promedio, costo del mejor individuo, kilometraje, nivel de riesgo medio y nivel de exigencia alcanzado.
- Si `verbose=True`, imprime en consola trazas periodicas del avance generacional.
- Retorna un diccionario con la mejor ruta (`ruta_ids`), objetos completos de destinos ordenados (`destinos_ordenados`), metricas finales de costo, distancia, tiempo, nivel de exigencia, riesgo medio, desglose tramo a tramo, historial completo y la grafica en ASCII.

### 6.3 Funcion de Entrada `optimizar_ruta_lomas(...)`

- Funciona como fachada publica para invocar el optimizador desde `main.py` o scripts externos, asegurando compatibilidad con los argumentos preexistentes.

### 6.4 Funcion CLI `main()`

- Utiliza `argparse` para proporcionar una interfaz de linea de comandos flexible con banderas `--k`, `--presupuesto`, `--dias`, `--gen`, `--pop`, `--semilla`, `--silencioso`.
- Incluye soporte UTF-8 automatico en consola Windows mediante `sys.stdout.reconfigure`.

---

## 7. Guia de Ejecucion por Terminal (CLI)

El modulo puede ejecutarse directamente desde la raiz del repositorio mediante la terminal.

### 7.1 Ejecucion Estandar con Parametros por Defecto

```powershell
python modules/genetic_algorithm.py
```

*Parametros aplicados por defecto:* $K = 3$ *lomas, presupuesto S/ 60.00, 3 dias, 50 generaciones, 40 individuos.*

### 7.2 Consulta de Ayuda y Opciones Disponibles

```powershell
python modules/genetic_algorithm.py --help
```

### 7.3 Ejecucion con Restricciones Personalizadas

#### Caso A: Viaje Corto de Fin de Semana (Presupuesto Ajustado)

```powershell
python modules/genetic_algorithm.py --k 2 --presupuesto 35 --dias 2 --gen 40 --pop 30
```

#### Caso B: Itinerario Extenso de Vacaciones (4 Lomas)

```powershell
python modules/genetic_algorithm.py --k 4 --presupuesto 90 --dias 4 --gen 60 --pop 50
```

#### Caso C: Ejecucion con Semilla Determinista (Reproducibilidad)

```powershell
python modules/genetic_algorithm.py --k 3 --presupuesto 70 --dias 3 --semilla 42
```

### 7.4 Ejemplo Real de Salida en Terminal

```text

  MODULO HEURISTICO: OPTIMIZACION MEDIANTE ALGORITMO GENETICO HIBRIDO

  Parametros de Entrada:
  - Destinos a seleccionar (K):  3
  - Presupuesto maximo:         S/ 70.00
  - Dias disponibles:           3
  - Generaciones:               50
  - Tamano de Poblacion:        40

  Iniciando proceso evolutivo...
  [Gen 001] Mejor Fit:  19.852 | Promedio:  14.210 | Costo: S/ 50.0 | Dist:  24.1 km | Exig: 0.45
  [Gen 010] Mejor Fit:  20.870 | Promedio:  19.540 | Costo: S/ 35.0 | Dist:  23.5 km | Exig: 0.58
  [Gen 020] Mejor Fit:  20.870 | Promedio:  20.120 | Costo: S/ 35.0 | Dist:  23.5 km | Exig: 0.58
  [Gen 030] Mejor Fit:  20.870 | Promedio:  20.450 | Costo: S/ 35.0 | Dist:  23.5 km | Exig: 0.58
  [Gen 040] Mejor Fit:  20.870 | Promedio:  20.610 | Costo: S/ 35.0 | Dist:  23.5 km | Exig: 0.58
  [Gen 050] Mejor Fit:  20.870 | Promedio:  20.780 | Costo: S/ 35.0 | Dist:  23.5 km | Exig: 0.58


  Curva de Convergencia del Fitness (Generaciones):
   20.87 ^------------------------------------------
   20.76 |     ************************************
   20.65 |     ||||||||||||||||||||||||||||||||||||
   20.54 |    *||||||||||||||||||||||||||||||||||||
   20.43 |    |||||||||||||||||||||||||||||||||||||
   20.32 |    |||||||||||||||||||||||||||||||||||||
   20.21 |    |||||||||||||||||||||||||||||||||||||
   20.10 |    |||||||||||||||||||||||||||||||||||||
   19.85 | ***|||||||||||||||||||||||||||||||||||||
         +---------------------------------------->
         Gen 1                            Gen 50


  RESULTADOS DE LA RUTA OPTIMIZADA:
  - Secuencia de IDs:        L4 -> L3 -> L0
  - Aptitud Final (Fitness): 20.870
  - Nivel de Exigencia:      0.58 (Moderado-Intenso)
  - Horas Recorrido Gen:     4.20 h
  - Cobertura de Zona Gen:   65.0 %
  - Extension Circuito Gen:  6.80 km
  - Riesgo Medio por Loma:   2.83 / 10.0 (Bajo)
  - Costo Total Estimado:    S/ 35.00 (Limite: S/ 70.00)
  - Distancia Inter-Loma:    23.55 km
  - Tiempo de Senderos:      12.00 horas
  - Estado del Presupuesto:  [CUMPLE]

  Detalle Parada por Parada:
    Parada 1: [L4] Lomas de Mangomarca (San Juan de Lurigancho)
              Dificultad: Moderado | Costo: S/ 10.00 | Tiempo: 4.0h | Riesgo: 2.8
    Parada 2: [L3] Lomas de Manchay (Ate)
              Dificultad: Moderado | Costo: S/ 10.00 | Tiempo: 3.5h | Riesgo: 3.5
    Parada 3: [L0] Lomas del Paraíso (+ Apu Siqay) (Villa María del Triunfo)
              Dificultad: Moderado | Costo: S/ 15.00 | Tiempo: 4.5h | Riesgo: 2.2

  Tramos de Desplazamiento Geografico:
    - De Lomas de Mangomarca hasta Lomas de Manchay: 16.06 km
    - De Lomas de Manchay hasta Lomas del Paraíso (+ Apu Siqay): 7.49 km

```

---

## 8. Pruebas Unitarias y Control de Calidad

El modulo cuenta con una suite de 10 pruebas unitarias en `tests/test_genetic.py`:

```powershell
python -m unittest tests/test_genetic.py -v
```

### Detalle de las Pruebas Implementadas:

1. `test_distancia_haversine`: Valida precision de calculo, simetria $d(A, B) = d(B, A)$ y caso nulo $d(A, A) = 0$.
2. `test_unicidad_cromosoma_y_tamano_k`: Valida que la ruta generada tenga exactamente $K$ destinos y cero duplicados.
3. `test_crossover_ox_validez`: Valida que el cruce Order Crossover con subconjuntos produzca hijos validos de tamano $K$ sin elementos repetidos.
4. `test_mutaciones_generan_cromosomas_validos`: Comprueba que las mutaciones Swap, Reemplazo e Inversion mantengan la longitud y la unicidad del cromosoma.
5. `test_penalizacion_presupuesto_en_fitness`: Verifica que ante presupuestos insuficientes el fitness decaiga cuadraticamente.
6. `test_penalizacion_tiempo_en_fitness`: Verifica la penalizacion si las horas totales superan las horas disponibles.
7. `test_penalizacion_distancia_en_fitness`: Verifica que rutas mas cortas tengan mayor fitness a igualdad de scores difusos.
8. `test_elitismo_no_regresion_fitness`: Verifica que el mejor fitness historico sea monotonicamente no decreciente a traves de las generaciones.
9. `test_caso_borde_k1`: Valida el comportamiento correcto cuando $K = 1$ (cero distancia de traslado inter-loma).
10. `test_reproducibilidad_con_semilla`: Verifica el determinismo del algoritmo ante una misma semilla pseudoaleatoria.

