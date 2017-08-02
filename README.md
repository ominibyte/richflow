RichFlow: Data processing for JavaScript
========================================
A framework for javascript data pipeline processing, data sharing and stream processing. Actionable & Transformable Pipeline data processing.

RichFlow is an extract of Flow, a node.js library built for data processing in the [JAMScript Framework](https://github.com/anrl/JAMScript-beta)

Installation
------------

`npm install richflow`


Usage
-----
The RichFlow library comes with several classes which can be used for different purposes. RichFlow is mostly based on JavaScript ES6.
For the basic Flow, 'require' it as follows:

```javascript
//in node.js
var {Flow} = require('richflow');

//in your browser
<script src="richflow.js"></script>
<script>
        var Flow = RichFlow.Flow;
</script>        
```


Flow can be used to operate on several data types including Arrays, Sets, Maps, FileSystem, Objects, Generators.
In addition, RichFlow comes with a Streamer object that allows data stream processing and allows Data sharing opportunities.

```javascript
var array = [1, 2, 3, 4, 5];

//For a very simple example. Let us count the number of even numbers in the array
var count = Flow.from(array).where(elem => elem % 2 == 0).count();

//create a data window and return a new array
var range = Flow.from(array).skip(1).limit(3).collect();
//The above line is equivalent to
var range = Flow.from(array).range(1, 4).collect();

//a few more possibilities
var anotherArray = [6, 7, 8, 9];
var average = Flow.from(array).merge(anotherArray).select(elem => elem * 5).average();

//check if all students passed
var studentScores = [71, 90, 55, 50, 88, 67];
var allPassed = Flow.from(studentScores).allMatch(score => score >= 50);

//an example of selectExpand: prints ["my","name","is","richboy"]
console.log(Flow.from("my name is richboy").selectExpand(input => input.split(" ")).collect());

//an example of selectFlatten: prints [1,2,3,4,5,6,7,8,9]
console.log(Flow.from([[1,2,3],[4,5,6],[7,8,9]]).selectFlatten().collect());
```

Understanding RichFlow
----------------------
A Flow is a data abstraction encapsulated within a JS ES6 class object that allows several operations on several data structures. Large collections of data can be processed efficiently. Flow allows programmers operate on data in somewhat similar way to SQL operations and it uses relatively similar query words.
Flow operations can either be methods/transformations (operations that yield other Flows) or actions (operations that yield a result).


Flow Creation
-------------
A Flow can be created from several Javascript data structures including: Array, Set, Map, Object, FileSystem, Generator, and Streamer (an in-built bare-bones class for supporting data streaming). The last two could potentially produce an infinite stream of data.

Here is an example of how a Flow can be created from a simple array:

```javascript
var array = [1, 0, 5, 13, -1];
var flow = Flow.from(array);
```

The above example creates an Iterator from the array from which data is pipelined.
Flow can also be created from a number range using:

```javascript
var flow = Flow.fromRange(3, 8);	//creates a Flow with [3,4,5,6,7,8]
```

Flow can also be created from several arguments using:

```javascript
var flow = Flow.of(1, 3, 4, 7);	//creates a Flow with [1,3,4,7]
```

The Flow.of(…) also allows creating Flow with empty array elements which could be operated on later. Flow.of(…) default to Flow.from(…) when the argument to the method is not a number and is a single argument. An example is shown below:

```javascript
var flow = Flow.of(3);		//creates a Flow with [[],[],[]]
```

Let us show a very simple use case for Flow.of(…) that is actually used within the Flow implementation:

```javascript
//A lazy way to create 5 queues.
var flow = Flow.of(5).map(array => new Queue());
```


Flow Methods
------------
Flow methods are data transformations that yield other Flows. Each Flow maintains a link to the Flow operation before it.
Flow methods are lazily computed, nothing happens to the underlying data until an action is called.
When an action is called on a Flow, data is continually streamed/piped down to the next Flow level for further processing as they are produced.
This can reduce the execution time because some operations can be handled together. The currently supported methods are listed below:

For most of the examples, we will be using the following extracted sample dataset of nobel prize winners for physics in 2016. The complete dataset is available at: [http://api.nobelprize.org/v1/prize.json](http://api.nobelprize.org/v1/prize.json)

```javascript
var winners = [
    {
      "id": "928",
      "firstname": "David J.",
      "surname": "Thouless",
      "motivation": "\"for theoretical discoveries of topological phase transitions and topological phases of matter\"",
      "share": "2"
    },
    {
      "id": "929",
      "firstname": "F. Duncan M.",
      "surname": "Haldane",
      "motivation": "\"for theoretical discoveries of topological phase transitions and topological phases of matter\"",
      "share": "4"
    },
    {
      "id": "930",
      "firstname": "J. Michael",
      "surname": "Kosterlitz",
      "motivation": "\"for theoretical discoveries of topological phase transitions and topological phases of matter\"",
      "share": "4"
    }
];
```

#### select(function | String) \[alias: map\]
This is similar to map in mad-reduce operations. This selects one or more parts of a data from a given dataset. As an example

```javascript
//we wish to get the surnames of all the winners
var selectFlow = Flow.from(winners).select(winner => winner.surname);   //returns a Flow object

//For objects as with the working example, we can also do:
var selectFlow = Flow.from(winners).select("surname");  //returns a Flow object
```

#### limit(Number)
To limit the number of results obtained after the previous operation.

```javascript
//let us say we want to restrict the result to the first two winners
var limitFlow = Flow.from(winners).limit(2);   //returns a Flow object

//get the ids of the first two winners
var ids = Flow.from(winners).limit(2).select("id").collect();   //returns an array
```

#### skip(Number)
To ignore the first given number of results found after a previous operation.

```javascript
//skip the first result
var skipFlow = Flow.from(winners).skip(1);   //returns a Flow object
```

#### range(startIndex: Number, endIndex: Number)
This method combines the implementations of limit and skip. It creates a bound for the data to be used for further processing.
startIndex is inclusive while endIndex is exclusive.

```javascript
//so if we want to get only the second person:
var rangeFlow = Flow.from(winners).range(1,2);   //returns a Flow object
```

#### selectExpand(function)
This maps one input to many outputs as generated by the function. The collection generated by function must be supported by Flow.from(…).

```javascript
var sentence = "my name is richboy";
var parts = Flow.from(sentence).selectExpand(input => input.split(" ")).collect();
//returns  ["my","name","is","richboy"]

//Another Example: rewrite the sentence with only words that are above 2 chars long
sentence = Flow.from(sentence).selectExpand(input => input.split(" ")).where(word => word.length > 2).join(" ");
//returns "name richboy"
```

#### selectFlatten()
This is similar to selectExpand, except that this doesn't take a function. Select flatten assumes that the input from the pipe is a collection that is supported by Flow.from(…).

```javascript
var flattened = Flow.from([[1,2,3],[4,5,6],[7,8,9]]).selectFlatten().collect();
//returns  [1,2,3,4,5,6,7,8,9]
```

#### where(function) \[alias: filter\]
This method performs a filtering operation on the data to match a constraint.

```javascript
//get all the even numbers from the array
var whereFlow = Flow.from([1,2,3,4,5,6,7,8,9]).where(num => num % 2 == 0); //returns a Flow object
```

#### orderBy(function | Flow.ASC | Flow.DESC | Flow.NUM_ASC | Flow.NUM_DESC)
This performs a sorting operation on the data based on a given function. Flow has internal operations to sort based on descending and ascending order.
You can provide your own sorting implementation which will normally be submitted to Array.prototype.sort() function.
*Flow.ASC* and *Flow.DESC* will sort according to each character's Unicode code point value, according to the string conversion of each element with the only difference being that *Flow.ASC* will sort in ascending order and *Flow.DESC* in descending order.
*Flow.NUM_ASC* and *Flow.NUM_DESC* with sort the elements as numbers.

```javascript
//sort the winners based on their surname
var orderedFlow = Flow.from(winners).select("surname").orderBy(Flow.ASC);   //returns a Flow object
```

#### merge(data)
This method is only available to an object of IteratorFlow and is used to merge a supported data structure as with Flow.from(data). Merging creates an Iterator and adds it to the current Iterator or Iterators.
This function also returns an IteratorFlow so one can do multiple merging on the return value.

```javascript
//let us merge the data for those who won the nobel prize for chemistry in 2016
var chemistryWinners = [
   {
     "id": "931",
     "firstname": "Jean-Pierre",
     "surname": "Sauvage",
     "motivation": "\"for the design and synthesis of molecular machines\"",
     "share": "3"
   },
   {
     "id": "932",
     "firstname": "Sir J. Fraser",
     "surname": "Stoddart",
     "motivation": "\"for the design and synthesis of molecular machines\"",
     "share": "3"
   },
   {
     "id": "933",
     "firstname": "Bernard L.",
     "surname": "Feringa",
     "motivation": "\"for the design and synthesis of molecular machines\"",
     "share": "3"
   }
];

var iteratorFlow = Flow.from(winners);  //IteratorFlow is the first flow in the chain
//merge both datasets and return the full names of all the winners
var allWinners = iteratorFlow.merge(chemistryWinners).select(winner => winner.firstname + " " + winner.surname).collect();
//returns ["David J. Thouless", "F. Duncan M. Haldane", "J. Michael Kosterlitz", "Jean-Pierre Sauvage", "Sir J. Fraser Stoddart", "Bernard L. Feringa"]
```

#### discretize(span, spanLength\[, spawnFlows\])
This method is best understood in the context of data streams. It allows processing data in windows.
*span* is the number of data streams to focus on in a window.
*spanLength* can either be a Number or a function that tells when we get to the end of a window.
*spawnFlows* is an optional boolean value that states if the output should be objects of DiscretizedFlow or simple arrays. spawnFlows defaults to true.

This method is available to all Flow objects but the implementation differs as with the IteratorFlow. See the advanced section for Usage.


Flow Actions
------------
Flow actions are operations that yield results that are not themselves Flows. When an action is called on a Flow, the Flow engine begins operating on the data and pipes each produces data to the next layer until the condition for the action is met. Based on the Flow definition, the operations could be carried out on a single core or multiple cores. The currently supported actions are listed below:

#### count()
Returns the total number of datasets left after the last Flow method.

```javascript
//get the count of all the even numbers from the array
var count = Flow.from([1,2,3,4,5,6,7,8,9]).where(num => num % 2 == 0).count();
//returns 4
```

#### findFirst()
Returns the first data available in a Flow.

```javascript
//get the first even number
var first = Flow.from([1,2,3,4,5,6,7,8,9]).where(num => num % 2 == 0).findFirst();
//returns 2
```

#### findLast()
Returns the last data available in a Flow.

```javascript
//get the last even number
var last = Flow.from([1,2,3,4,5,6,7,8,9]).where(num => num % 2 == 0).findLast();
//returns 8
```

#### findAny()
This returns any data from the Flow. This currently does the same as findFirst(). This methods is expected to work best in a parallel computing sense with ParallelFlow.

```javascript
//get the count of all the even numbers from the array
var any = Flow.from([1,2,3,4,5,6,7,8,9]).where(num => num % 2 == 0).findAny();
//returns 2
```

#### groupBy(function | String)
This returns the data as a JS object partitioned into array of groups, determined by the function.
The argument can either be a function (that receives an item each time to generate the group that items belongs to) or a key (from which the group will be determined using JS object syntax like input\[key\]).

```javascript
var array = [
    {entity: "book", bookID: 12},
    {entity: "student", studentID: 23434},
    {entity: "student", studentID: 12233},
    {entity: "book", bookID: 998}
];

//we want to group by entity so all entries with same entity value would be grouped together
let groups = Flow.from(array).groupBy("entity");
//groups will contain:
/*
{
	"book": [{entity: "book", bookID: 12}, {entity: "book", bookID: 998}],
	"student": [{entity: "student", studentID: 23434}, {entity: "student", studentID: 12233}]
}
*/
```

#### collect(\[function\])
This returns the data as either an Array, Set or Map. The function argument is optional and default to returning an array.
The function argument is a Flow internal function which can either be Flow.toSet(), Flow.toArray() or Flow.toMap(keyFunc). It is also possible to ignore the parenthesis for the array and set as Flow.toArray and Flow.toSet respectively.
`collect`ing with Flow.toSet returns a distinct dataset, `collect`ing with Flow.toArray returns all the data left after the last Flow method as an array while `collect`ing with Flow.toMap(keyFunc) returns a JS ES6 Map. The keyFunc in Flow.toMap() is same as the function supplied to groupBy. The only difference between calling collect with toMap(keyFunc) and calling groupBy(keyFunc) is that toMap returns an ES6 Map object while groupBy returns a plain JS object.

```javascript
var array = [
    {entity: "book", bookID: 12},
    {entity: "student", studentID: 23434},
    {entity: "student", studentID: 12233},
    {entity: "book", bookID: 998}
];

//collecting to Array. Note that this exactly same without Flow.toArray
var entities = Flow.from(array).select("entity").collect(Flow.toArray);
//returns ["book", "student", "student", "book"]

//collecting to Set
var entitySet = Flow.from(array).select("entity").collect(Flow.toSet);
//returns Set(2) {"book", "student"}

//collecting all to Map
var map = Flow.from(array).collect(Flow.toMap("entity"));
/*
    returns:
    Map(2) {
        "book" => (2) [{entity: "book", bookID: 12}, {entity: "book", bookID: 998}],
        "student" => (2) [{entity: "student", studentID: 23434}, {entity: "student", studentID: 12233}]
    }
*/
```

#### join([delimiter: String])
This function joins the outputs by a delimiter which is optional. The delimiter argument defaults to ",".

```javascript
var joined = Flow.from([1,2,3,4,5]).map(num => num * 5).limit(3).join(" | ");
//returns 5 | 10 | 15
```

#### forEach(function) \[alias: foreach\]
This sends the remaining data from the last Flow in the chain to the custom function provided. The user may wish to operate on each data outside the context of Flow.

```javascript
//print all even numbers to the console
Flow.from([1,2,3,4,5,6,7,8,9]).where(num => num % 2 == 0).foreach(console.log);
```

#### anyMatch(function)
This returns a boolean to check if the remaining data matches the definition in the user defined function.

```javascript
//check if there is any number in the array that if we multiply with 5 yields 35
var match = Flow.from([1,2,3,4,5,6,7,8,9]).anyMatch(num => num * 5 == 35);
//returns true
```

#### allMatch(function)
Similar to anyMatch, this checks that all the remaining data matches the condition defined in the function.

```javascript
//check if multiplying 5 with all numbers in the array yields 35
var match = Flow.from([1,2,3,4,5,6,7,8,9]).allMatch(num => num * 5 == 35);
//returns false
```

#### noneMatch(function)
This may look like the inverse of allMatch but it is more closely related to anyMatch. This basically checks that no item matches the condition defined in the function argument.

```javascript
//check that multiplying 5 with any numbers in the array DOES NOT yield 35
var match = Flow.from([1,2,3,4,5,6,7,8,9]).noneMatch(num => num * 5 == 35);
//returns false
```

#### reduce(initial, function)
This allows a Flow to be reduced to a single value. It takes the initial value for the reduce operation and the function that defines how the reduce would be carried out.
The function parameter takes two arguments (in the order: currentValue and newValue) and is expected to return a value which is further fed in as the currentValue for the next iteration. The function is called until all values are piped out of the Flow chain.

```javascript
//let us implement getting the sum of numbers
var sum = Flow.from([1,2,3,4,5]).reduce(0, (cv, nv) => cv + nv);
//returns 15
```

#### sum()
This is a reduce operation that returns the sum. It is expected that the values a the last Flow item in the chain return Number types.

```javascript
var sum = Flow.from([1,2,3,4,5]).sum();
//returns 15
```

#### average()
This is also a reduce operation that returns the average. It is expected that the values a the last Flow item in the chain return Number types.

```javascript
var avg = Flow.from([1,2,3,4,5]).average();
//returns 3
```

#### max()
This returns the maximum number. It is expected that the values a the last Flow item in the chain return Number types.

```javascript
var max = Flow.from([1,2,3,4,5]).max();
//returns 5
```

#### min()
This returns the minimum number. It is expected that the values a the last Flow item in the chain return Number types.

```javascript
var min = Flow.from([1,2,3,4,5]).min();
//returns 1
```


Flow from FileSystem (for node.js)
----------------------------------
Flow does not current work with the browser FileReader due to the way the FileReader is designed, which differs from the synchronous design of Flow.
For working with files in node, The Flow.from() method accepts a string path to the file. However, the path needs to be prepended with "fs://". This is used to distinguish working with files from strings.
Files are processed by line. As an example:

```javascript
//we have a file called names.txt in the same directory
Flow.from("fs://./names.txt").range(0, 11).foreach(line => console.log(line));
```


Advanced + Design Info
----------------------
### Flow Groups
There are 5 Flow groups namely: IteratorFlow, OutFlow, InFlow, DiscretizedFlow and Flow (the default Flow). They are grouped based on the type of operations that can be performed on them.

i. IteratorFlow: This is mostly the first Flow in a Flow chain. When the Flow.from(…) method is called, an IteratorFlow is created. This flow extends the default Flow and provides a few more operations.

ii. OutFlow: This Flow is responsible for processing and sending data across applications. More information on this later.

iii. InFlow: This Flow is responsible for receiving data from another application. Also, more information on this later.

iv. DiscretizedFlow: This Flow splits data streams into chunks/windows to allow for Flow methods that require finite data operations. Discretized Flows are discussed much later.

v. Flow: This is the default Flow that has all the basic operations for data processing.

### Flow Chain Pipelining
A Flow chain is a linked data structure of different Flow objects. Every Flow is aware of the previous Flow and the next Flow in the chain. A Flow chain is created when a Flow method is called on a Flow object.
As an example:

```javascript
var flow = Flow.from(array).skip(2).where((num) => num % 2 == 0);
```

From the example above, there are three Flow objects in the Flow chain. When an action is called on the final flow object, data is piped through the Flow chain till it gets to the last Flow in the chain, from which the action is computed.

### Flow Push & Pull Models
Flow provides two modes of data pipelining: push and pull. The pull model is used to request that data be piped from the IteratorFlow (discussed later) through the chain. The data is generated from the Iterator when requested and sent through the chain. This mode is used by Flow actions to do a final computation on the dataset. For the push model, data is automatically piped through the Flow chain. The push model is used in Flow Streaming.

### Flow Streaming & The Streamer Class
For continuous streams of data, Flow provides a data push model that can continuously pipe data through the Flow chain. This can be especially useful if computed data needs to be sent to another application for further processing. Each Flow pushes processed data to the next Flow in the chain or to a customizable terminal function (If the Flow is the last in the chain). The terminal function for a Flow can be set using the setTerminalFunction method. Flow streaming can be achieved when the Flow is created from either a Streamer or a function that generates continuous data like a JS Generator. An example of working with Streamer is shown below:

```javascript
//import Flow and Streamer
var Flow = RichFlow.Flow;
var Streamer = RichFlow.Streamer;
//create a new streamer
var streamer = new Streamer();  

//create a Flow from the streamer. Several streamers can be added via the merge method
var flow = Flow.from(streamer).filter(num => num % 2 != 0);  //filter for odd numbers
//set the terminal function which will receive the data from the last Flow in the chain
flow.setTerminalFunction(console.log); //print to the console
//Inform the IteratorFlow to start listening for data from the streamer
flow.startPush(); //This can be called from any Flow in the chain.

setInterval(() => {
    streamer.send(parseInt(Math.random() * 10)); //send data to all listeners
}, 500);
```

**NOTE**: If the `startPush` method is called after the Streamer starts generating data, some data may be lost at the initial stage.

The Streamer class is bare-bones and does minimal work. It can be extended to do much more like working as a finite dataset. Data could be received from the OutFlow and cached or data it generates could be cached and reused as a finite dataset using the Flow pull mode. If you wish to use the Streamer in Flow pull mode, you will need to extend the class and provide implementation for the `size` and `get` methods.

The Streamer class can act as a stream provider and a stream receiver as well. A function can be supplied to the constructor of the Streamer to receive stream data. More on this on the InFlow and OutFlow sections.

### IteratorFlow
The IteratorFlow is a Flow that creates a unified means of retrieving data from different data structures. The IteratorFlow turns the data passed to Flow.from(…) into a Javascript Iterable by wrapping the data with an iterator implementation that makes retrieving data as easy as calling a next() method on the iterator handle. More Iterators can be added via the merge method on an object of IteratorFlow. The merge method takes the same type of parameter as the Flow.from(…) method.

This Flow is the Root Flow of the Flow chain and can be accessed from any Flow in the chain via the property rootFlow. As an example:

```javascript
var flow = Flow.from(array).skip(2).where((num) => num % 2 == 0);
var iteratorFlow = flow.rootFlow;	//get access to the IteratorFlow
```

For data streaming in Flow, the IteratorFlow needs to listen for changes on the Streamer object(s) and retrieves new data when data is sent via the Streamer.send() method. The retrieved data is pushed through the Flow chain till it gets to an OutFlow or the terminal function of the last Flow object in the chain. To start data streaming in Flow, the startPush() method needs to be called on an object of the IteratorFlow. To stop the streaming at anytime, the stopPush() method can be called on the IteratorFlow object. When the stopPush() method is called, the IteratorFlow disconnects from the Streamers and stops listening for incoming data on the connected streams.


### DiscretizerFlow & DiscretizedFlow
DiscretizerFlow partitions streams of data flowing through the Flow chain into windows and each data window could be emitted as a DiscretizedFlow or an array. Actually, discretization can also occur for static/finite datasets like arrays or generators. DiscretizedFlows are IteratorFlows and could themselves be discretized and Flow actions can be called on them. Any Flow can be discretized (with an exception to OutFlow). However, the discretization implementation in IteratorFlow differs from the implementation on others Flow.

IteratorFlow handles the discretization process internally, while the DiscretizerFlow handles discretization for all other Flows. For IteratorFlow discretization, the data window can be created from a single iterator or multiple iterators (this could be a single datastream or multiple datastream) while the discretization for other Flow groups are done on the input data. The discretize method takes three arguments namely - the window span, the span length and a boolean value indicating if data should be spawned as discretized flows or as arrays. The third argument is optional and defaults to true.

For IteratorFlow discretization, the window span talks about how many iterators should be included in creating the window. Recall that an Iterator can be added via the IteratorFlow.merge(…) method. A block of data is a data structure that has one item from each iterator from the window. The span length is the number of data blocks that should constitute a discrete block. Span length can be a number, a function or an object having an ‘isDataEnd’ function. The function receives two arguments - the last data added and the current length of the window span and should evaluate to a boolean.

For other Flow groups, discretization is on the input. It is the responsibility of the programmer to ensure that the data received as input to the DiscretizerFlow is fit for discretization and it is assumed that each data piped can be broken down is the way needed by the programmer. When DiscretizerFlow determines that it is not possible to discretize ‘perfectly’, the implementation respects the programmers wish and fills the remaining slots  in the data block with null values. The discretize method take in the same arguments and the span length follows the same as that of IteratorFlow. The window span here talks about how many parts each input piped to the DiscretizerFlow can be broken down. It is assumed that when each input is passed to Flow.from(…), it should be able to create an Iterator that will generate the amount of data required by the programmer.

```javascript
//lazily create 4 streamers
var streamers = Flow.of(4).map(a => new Streamer()).collect();
//we need to merge all the streams so we start by adding one
var flow = Flow.from(streamers[0]);
for( i = 1; i < streamers.length; i++ )
    flow = flow.merge(streamers[i]);  //merge the remainder
//discretize with a span covering all streams and data length of 1
var discretizerFlow = flow.discretize(streamers.length, 1);
//set the terminal function
discretizerFlow.setTerminalFunction(discretizedFlow => console.log(discretizedFlow.selectFlatten().collect()));
discretizerFlow.startPush();  //start listening for data on the Streamers

setInterval(() => {
    streamers.forEach(streamer => streamer.send(parseInt(Math.random() * 10)));
}, 500);
```

### OutFlow
In [JAMScript](https://github.com/anrl/JAMScript-beta), OutFlow was built as a specialized Flow for the purpose of sending processed data to external applications. Here, the OutFlow has been stripped of that functionality. Though the concept is still part of it but that is now the responsibility of Streamer. When an OutFlow is created, a Flow object is supplied as a argument which the OutFlow links to, in order to receive pushed data. A Streamer object is also provided as the second argument in the constructor to which the OutFlow is expected to push the data and an identifier key which can optionally be supplied as a third argument (If none is supplied, one is auto generated). A Streamer could for instance generate stream data from sensors and write to a datastore such as Redis or send the computed data elsewhere. Let us see an example with Redis:

```javascript
//require OutFlow, Flow and Streamer
const {Flow, Streamer, OutFlow} = require('richflow');  //in node.js (See top for browser)
var Redis = require('redis-fast-driver'); //require Redis
var redis = new Redis({host: '127.0.0.1', port: 6379}); //establish connection

//create 4 streamers. Could listen to sensors and obtain data
var streamers = Flow.of(4).map(a => new Streamer()).collect();

//we need to merge all the streams so we start by adding one
var flow = Flow.from(streamers[0]);
for( i = 1; i < streamers.length; i++ )
    flow = flow.merge(streamers[i]);  //merge the remainder

var outFlow = new OutFlow(flow.discretize(streamers.length, 1),
                            new Streamer((dFlow, key) => {
                              let avg = dFlow.selectFlatten().average();
                              let timestamp = new Date().getTime();
                              redis.rawCall(['ZADD', key, timestamp, avg + '']);
                            }), "App1.Key");
outFlow.start();  //inform the IteratorFlow to begin pushing data

//simulate sensor data
setInterval(() => {
    streamers.forEach(streamer => streamer.send(parseInt(Math.random() * 10)));
}, 500);
```

The start() method in OutFlow calls the startPush() method in the IteratorFlow (the first flow in the chain) and informs the IteratorFlow to start listening for push data from the data source. This data is continually pushed and may or may not get to the OutFlow based on the constraints within each Flow object in the Flow chain. As data arrives at the OutFlow, it is sent to the Streamer which further sends it to Redis.
To stop listening to data streams,  the programmer can call the OutFlow stop method on the object handle which will in turn call the stopPush() method on the IteratorFlow. For example:

```javascript
outFlow.stop();
```

### InFlow
This is also another specialized Flow. In [JAMScript](https://github.com/anrl/JAMScript-beta) it is solely responsible for retrieving data from an external application. The retrieved data can be taken through further processing along a Flow chain before being used. Here, the InFlow can listens for new data from the Streamer and push them onwards to any connected Flow. An example with Redis following from the OutFlow:

```javascript
//require InFlow, Flow and Streamer
const {Flow, Streamer, InFlow} = require('richflow');  //in node.js (See top for browser)
var Redis = require('redis-fast-driver'); //require Redis
var redis = new Redis({host: '127.0.0.1', port: 6379}); //establish connection

class MyStreamer extends Streamer{
  constructor(){
    super();
    this.lastIndex = 0;
    //listen for new data on Redis
    redis.rawCall(['config', 'set', 'notify-keyspace-events', 'Ez']);
    redis.rawCall(['psubscribe', '__keyevent*'], this.notify);
  }
  notify(e, data){
    if(data[0] == "pmessage" && data[3]){ //check if a message has arrived
      //get data from Redis
      var self = this;
      redis.rawCall(['ZRANGE', "App1.Key", this.lastIndex + 1, -1], function(err, resp){
          if( err )
              throw new Error(err);

          for (var i = 0; i < resp.length; i++) {
              self.lastIndex++;
              self.send(resp[i]); //send data to all listeners like InFlow
          }
      });
    }
  }
}

var inflow = new InFlow(new MyStreamer());
var flow = inflow.where(avg => avg > 5);  //filter for averages above 5
flow.setTerminalFunction(console.log);  //print to the console
```

### Flow Caching

This is an internal process that aims to speed up Flow reuse and works with static/finite data sets (does not work with Flow streaming). Flow attempts to get data from the Iterators each time an action is called on the Flow. However, for static/finite datasets, the iterators will produce same data each time leading to a time wastage when piping through the Flow chain each time. By caching processed data, when ever an action is called on a Flow (a second time), because it has already processed the data during the first round, it serves the processed data, saving processing time. Caching IteratorFlow data is trivial so they are never cached. However, this caching is on memory. Currently, the cache stays on for as long as the Flow has not be garbage collected.


Common Pitfalls
---------------
The `null` value has a special meaning within Flow so your data should not contain it. This could cause Flow to give a fake report.

By default, Flow caches outputs for faster reuse. However, this can cause certain issues if the underlying data source changes. With caching, the changes will not be reflected when the constructed Flow is being reused. Let us see a simple example with Arrays:

```javascript
//with caching
var arr = [1,2,3,4,5,6,7,8,9];
var flow = Flow.from(arr).where(num => num % 2 == 0);
console.log(flow.count());  //prints 4
arr.push(0);
console.log(flow.count());  //prints 4

//without caching
var arr = [1,2,3,4,5,6,7,8,9];
var flow = Flow.from(arr).where(num => num % 2 == 0);
flow.rootFlow.shouldCache = false;
console.log(flow.count());  //prints 4
arr.push(0);
console.log(flow.count());  //prints 5
```

To disable caching, after creating the Flow, on the IteratorFlow do the following:

```javascript
var iteratorFlow = Flow.from(…);
iteratorFlow.shouldCache = false; //needs to be done before any action is called
```

Another common pitfall you may have is in reusing Flows. Each Iterator in the IteratorFlow maintains a cursor on where the next data should be obtained from. Now, because the pipeline process ensures that the minimum amount of work is done to produce the desired result, it will sometimes be the case that an iterator may not get to the end and thus reusing will resume the cursor of the iterator from the last placed it stopped and will yield unexpected results. Do not reuse Flows if you do not understand this concept. As an example:

```javascript
var flow = Flow.fromRange(1, 10); //creates a Flow with numbers from 1 to 10
console.log(flow.limit(5).collect()); //prints [1,2,3,4,5]
flow.forEach(console.log);  //prints 7 8 9 10
```

From the above code, you can notice that the call to forEach prints what is left as opposed to all the content from 1 to 10. This type of error can be fixed in most cases by flushing the contents of the flow before reusing. Sometimes, it can only be fixed with a combination of turning off caching and flushing and other times it may take more than that. **Flow reuse should be done with caution**. To fix the above error, we can do the following:

```javascript
var flow = Flow.fromRange(1, 10); //creates a Flow with numbers from 1 to 10
console.log(flow.limit(5).collect()); //prints [1,2,3,4,5]
//flush the remaining contents. The iterators automatically reset for reuse when they get to the end
flow.count();
flow.forEach(console.log);  //prints 1 2 3 4 5 6 7 8 9 10
```

Roadmap
-------
i. ParallelFlow: A truly parallel pipeline data processing library.

ii. Flow Caching Offloading: An investigation needs to be made on when and which Flows to release memory, especially when the system is running low on RAM storage. There could be a listener that listens out for memory changes and probably informs Flows to either save processed data to disk or release the data. Based on the size of data held by the Flows in the middle of the chain, the runtime could decide which will be faster, saving to the disk and reloading from disk when needed or recomputing from the previous Flow in the chain.

Contact
-------
For questions or suggestions please send a message to david.echomgbe \[@\] gmail.com. Please prefix your email subject with "RichFlow -".
