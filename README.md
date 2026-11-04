# Sistema Inteligente de Optimización de Rutas de Trekking en las Lomas de Lima

> **Nota de lectura.** Este README contiene la **Parte 0 (Propuesta de Modelo de Negocio)**, la vision de producto y negocio en construccion. La documentacion tecnica y academica del proyecto (motor de logica difusa, algoritmo genetico, arquitectura) se encuentra en [`docs/informe_tecnico.md`](docs/informe_tecnico.md).

---

## Parte 0: Propuesta de Modelo de Negocio (Documento Vivo)

*Última actualización: 2026-11-04. Estado: en validación de mercado, previo a trabajo de campo.*

### 0.1 Resumen ejecutivo

El producto nació como un planificador B2C de rutas de trekking para las lomas de Lima, monetizado con micropagos de pago único (S/4.90 a S/19.90). El análisis de negocio concluyó que ese modelo no es viable como empresa: mercado estacional, sin retención y con disposición a pagar casi nula.

El giro propuesto: **convertirse en la plataforma de confianza para descubrir y reservar viajes de aventura de fin de semana cerca de Lima**, agregando la oferta de las micro-agencias que hoy operan por WhatsApp e Instagram. La entrada al mercado no es un catálogo neutral, sino **automatizar el trabajo manual del funnel de reserva de una agencia** (herramienta), para luego agregar la demanda del viajero (marketplace). El diferenciador central es la **confianza y la seguridad**: pago protegido, agencias verificadas, reseñas y los activos de seguridad ya construidos (navegación offline, SOS, dificultad estandarizada).

En una frase: **dejar los micropagos de lomas y ser el motor invisible que le quita a cada agencia las horas diarias de gestión manual por WhatsApp, manteniendo intacta su comunidad, para después concentrar la demanda.**

### 0.2 Los huecos del modelo original (por qué pivotar)

- **Estacionalidad:** las lomas solo se visitan en garúa (junio a octubre). Un negocio que factura medio año nace cojo.
- **Sin retención:** el usuario típico visita lomas una vez al año, casi siempre una sola loma y en grupo. Mal perfil para una app de consumo.
- **Disposición a pagar nula:** público sensible al precio que percibe la información como algo que debería ser gratis. Aun con conversión optimista, los micropagos no sostienen una empresa.
- **Diagnóstico:** se construyó algo técnicamente sólido apuntando al bolsillo equivocado. El dinero no está en venderle información al turista, sino en la transacción de reserva.

### 0.3 El hallazgo de mercado

El caso de referencia es **Aventureros Perú Travel** (ver `ItinerarioVichaycocha.pdf`), una micro-agencia que opera así:

- Lleva grupos a destinos variados (no solo lomas; Vichaycocha es trekking de altura en Huaral), **todos los fines de semana, todo el año**.
- Cobra alrededor de **S/145 por persona** (precios netos sin IGV; tarjeta con recargo de 5 por ciento).
- Inscrita en MINCETUR, con RUC, y trabaja con operadores locales aliados.

Comparado con los S/5 a S/20 de los micropagos de lomas, el ticket es entre 10 y 30 veces mayor, y es un mercado que funciona los doce meses. El público es doméstico (limeños), no el turista extranjero.

### 0.4 El funnel operativo real de una agencia (trabajo de campo preliminar)

Reconstrucción del flujo de Aventureros a partir de observación:

1. **Grupo de WhatsApp por destino:** reúne a los interesados en ese lugar, con varias fechas de fin de semana.
2. En el grupo se publican **ofertas y un adelanto de S/100**; el resto se paga el día del viaje.
3. El viajero paga el adelanto y **envía la captura** al chat privado del gestor, que responde y envía un **formulario de Google** para tomar sus datos, más nombre y apellido para agendarlo.
4. Se agrega al viajero a un **segundo grupo de WhatsApp**, el de quienes ya pagaron para una fecha concreta, donde se coordinan ubicaciones y logística.
5. Existe una **comunidad** que anima a reservar; la experiencia se siente amena y personalizada.
6. **Dolor observado:** cada persona nueva que entra obliga a reenviar toda la información y a animarla de nuevo, manualmente.
7. La web de la agencia es un catálogo que normalmente deriva a WhatsApp (no hay reserva real en línea).

### 0.5 Análisis competitivo

Hallazgo: **no existe un marketplace para el segmento doméstico de aventura de fin de semana** (limeños, bus, S/100 a S/150, vendido por Instagram y WhatsApp). Los agregadores que sí existen atienden un segmento distinto (turista extranjero o premium, turismo clásico en USD):

| Plataforma | A quién sirve | ¿Cubre este segmento? |
| --- | --- | --- |
| Viator, GetYourGuide | Turista extranjero, premium, city tours, USD | No |
| Civitatis | Turismo clásico en español, sightseeing | No |
| Denomades / Nomades | Modelo marketplace probado en Perú; turismo clásico | No (upmarket) |
| TourRadar | Directorio internacional de tours multi-día | No |
| Micro-agencias (Aventureros, Mochilea, Mapi) | Limeños, finde, trekking, bus | Ese es el mercado objetivo |

Conclusión: es una entrada por **segmento desatendido**, no una categoría inexistente. Denomades prueba que el modelo de agregar operadores locales funciona en Perú; el hueco está en el público doméstico de bajo ticket que los incumbentes ignoran.

Fuentes consultadas: Denomades Lima (`denomades.com/en/lima`), Viator Lima Full-day Tours (`viator.com`), Civitatis Day Trips from Lima (`civitatis.com`), Mochilea Perú (`mochileaperu.com`), Mapi Trekking Perú (`mapitrekkingperu.com`).

### 0.6 El modelo elegido: plataforma (herramienta primero, marketplace después)

Rol decidido: **plataforma**, no operador propio ni SaaS puro.

El mayor riesgo de un marketplace es el arranque en frío de la oferta. La estrategia lo resuelve en dos tiempos:

1. **Herramienta para la agencia:** se le entrega un sistema de reservas que automatiza su funnel manual. Esto captura oferta, inventario y pasarela de pago una agencia a la vez, y cada agencia aporta a sus propios clientes.
2. **Marketplace para el viajero:** una vez concentrada suficiente oferta, se abre la cara de descubrimiento y reserva para el viajero, sobre inventario que ya se hospeda.

### 0.7 El diferenciador: confianza, seguridad y pago protegido

El wedge no es un catálogo más bonito. Es resolver que hoy el mercado funciona a pura fe: la gente hace un Yape de más de S/100 a la cuenta personal de un desconocido, con política de no devolución, para un trekking de altura.

- **Pago protegido / escrow:** retener el adelanto hasta que el viaje se concreta, lo que elimina el miedo a la estafa o a que el viaje no salga.
- **Agencias verificadas** (RUC, MINCETUR) y **reseñas**.
- **Dificultad y seguridad estandarizadas** usando los scores difusos ya construidos.
- **Activos de seguridad ya desarrollados** (navegación offline, SOS, Guardián Anti-Neblina) como marca de confianza.

Esto unifica los activos técnicos existentes (LomaCast, ruteo, lógica difusa, offline) bajo una sola propuesta: la forma segura y confiable de reservar aventuras de fin de semana. El algoritmo genético pasa a ser vitrina técnica, no el centro del producto.

### 0.8 Dolores operativos y oportunidades de producto

| Lo que la agencia hace a mano hoy | Qué automatiza la plataforma | ¿Intervenir? |
| --- | --- | --- |
| Reenviar la información a cada nuevo integrante | Enlace o bienvenida automática con toda la información | Sí |
| Leer capturas de Yape una por una | Pago con confirmación automática | Sí |
| Formulario de Google suelto y pedir el nombre | Datos del viajero atados al pago, en un paso | Sí |
| Agendar a mano por nombre | Roster y control de asientos por fecha | Sí |
| Crear el grupo de la fecha y añadir a la gente | Auto-agrupar a los que pagaron y enviar logística | Sí |
| Animar, dar vibe, responder dudas | Nada. Esa es su ventaja | Nunca |

**Reglas de oro:**

1. **Automatizar la burocracia, jamás la comunidad.** La comunidad es el moat de la agencia; replicarla con un checkout frío destruiría la razón por la que la gente reserva.
2. **Cobrar comisión solo sobre la demanda que trae la plataforma**, no sobre los clientes propios de la agencia. De lo contrario, la agencia se siente gravada por clientes que ya tenía y abandona.

### 0.9 Riesgos principales

- **La comunidad no es fungible:** el cliente reserva por la persona y el vibe, no solo por destino y precio. Un marketplace neutral corre el riesgo de commoditizar justo eso.
- **Miedo a la desintermediación:** las agencias pueden temer que se les roben los clientes. Se mitiga con la regla de oro de la comisión.
- **Oferta informal y fragmentada:** onboarding de alto contacto.
- **Manejo de dinero de terceros:** al inicio conviene no retener fondos como transmisor de dinero; cobrar como fee al viajero o mediante un modelo que evite ese estatus legal.
- **Responsabilidad en actividades físicas de riesgo:** términos y condiciones claros, solo agencias con RUC y MINCETUR, reseñas.

### 0.10 Plan por fases

1. **Fase 0, validar:** trabajo de campo con una agencia; confirmar dolores reales. No construir aún.
2. **Fase 1, herramienta (MVP):** sistema de reserva y pago para una agencia aliada (página pública de viaje, pago Yape con confirmación automática, datos atados al pago, roster por fecha, recordatorios). Reutiliza el checkout Yape ya existente.
3. **Fase 2, densidad:** onboarding de 20 a 40 agencias; monetización ligera por reserva o plan premium.
4. **Fase 3, marketplace:** cara de viajero con descubrimiento, reseñas, pago protegido y los diferenciadores de seguridad. Comisión del 15 al 20 por ciento solo sobre demanda originada en la plataforma.
5. **Fase 4, defensa:** reputación, datos de demanda, y expansión a otras ciudades.

### 0.11 Próximos pasos inmediatos

1. **Viaje de campo** (pendiente): vivir el flujo de una agencia desde adentro para analizar su gestión interna.
2. **Consulta de descubrimiento** a la agencia, con enfoque en el pasado y lo concreto, no en hipotéticos. Evitar preguntar si querrían una web (genera un sí por cortesía). Preguntas guía:
   - ¿Cuánto tiempo al día pasan respondiendo el mismo mensaje de bienvenida?
   - La última vez que alguien pagó pero no llenó el formulario, ¿qué pasó?
   - ¿Qué es lo más tedioso de armar un viaje nuevo?
   - ¿Qué pasa cuando alguien quiere cambiar de fecha o cancelar?
   - ¿Cómo saben cuántos asientos quedan? ¿Alguna vez sobrevendieron?
   - ¿Han probado alguna herramienta para esto y por qué la dejaron?
3. **Validación de demanda barata** (antes de construir el producto completo): una landing que liste los viajes reales de un fin de semana con pago protegido, con tráfico de Instagram o TikTok, para medir si el viajero reserva a través de la plataforma en vez de ir directo a la agencia.

### 0.12 Preguntas abiertas por resolver tras el viaje

- ¿Cuál es el dolor número uno que repiten las agencias: el funnel manual, el control de asientos, los no-shows o la captación?
- ¿Cómo manejan internamente el pago del día (efectivo, conciliación)?
- ¿Cuántas personas gestionan la operación y cuánto tiempo invierten en tareas repetitivas?
- ¿Estaría una agencia dispuesta a ser socia de diseño de la Fase 1?
- ¿La marca "Lomosoma" debe ampliarse a una marca paraguas de salidas de día?

---

## Documentacion tecnica

La documentacion tecnica y academica completa (logica difusa, algoritmo genetico, arquitectura, catalogo de destinos e interfaz grafica) se encuentra en [`docs/informe_tecnico.md`](docs/informe_tecnico.md).
