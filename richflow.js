/**
 * Created by Richboy on 30/05/17.
 */

"use strict";

(function(root, factory){
    if (typeof exports === "object" && exports) {
        factory(exports); // CommonJS
    }
    else {
        var RichFlow = {};
        factory(RichFlow);
        if (typeof define === "function" && define.amd) {
            define(RichFlow); // AMD
        }
        else {
            root.RichFlow = RichFlow; // <script>
        }
    }
}(this, function(RichFlow){
    class Flow{
        constructor() {
            this.prev = null;    //The parent of this Flow
            this.next = null;    //The children of this Flow
            this.pipeFunc = (output) => output;    //The Pipe function to execute for this Flow
            this.rootFlow = null;   //The First Flow...to be used for push operations (Can be used for InFlow/OutFlow)
            this.terminalFunc = (output) => {}; //This is the Flow terminal function for a push operation. It is mostly for the last created Flow in the Flow chain.
            this.isDiscretized = false;

            //TODO still under investigation...in beta
            this.elements = []; //The processed elements from this Flow. This saves them in memory for later reconstruction
            this.ended = false; //If we have seen the last of data for this Flow. This tells us when to take data from the elements cache
            this.elemPos = 0;   //The index position in the elements array that we currently are in
        }

        /**
         * This method uses the flow linking construct to trigger data processing
         * @returns {*}
         */
        process(){
            if( this.ended )
                return this._getElement();

            //because of the potential of reusing Flow as bases for others, we need to make sure
            //that when a Flow is being called, it is linked to the parent.
            if( this.prev.next != this )//if the parent was linked to another Flow, bring back the link
                this.prev.next = this;

            var obj = this.prev.process();
            if(obj == null)
                this._addElement(null);

            return obj;
        }

        startPush(){
            this.prev.startPush();
        }

        stopPush(){
            this.prev.stopPush();
        }

        //May be removed. Not currently used
        reset(){
            this.ended = false;
            this.elements = [];
        }

        /**
         * This method is used for the Pipeline operation.
         * It receives data from the previous Flow and channels the processed data to the next Flow (if any).
         * @param input the input from the previous Flow
         * @returns {*}
         */
        pipe(input){
            var outcome = this.pipeFunc(input);

            this._addElement(outcome);

            if( this.next !== null )
                return this.next.pipe(outcome);

            return outcome;
        }


        push(input){
            var outcome = this.pipeFunc(input);

            if( this.next !== null )
                this.next.push(outcome);
            else
                this.terminalFunc(outcome);
        }

        /**
         * This method is used to set a custom terminal function for the push on the last created Flow in the Flow chain
         * @param func the custom function to call with the last output
         */
        setTerminalFunction(func){
            if( Util.isFunction(func) )
                this.terminalFunc = func;
        }


        /**
         * This method create a Flow from several data types. Supported data types are: Array, Flow, Map, Set, Object, FileSystem, JAMLogger
         * @param data the data from which a Flow object would be created
         */
        static from(data){
            return FlowFactory.getFlow(data);
        }

        /**
         * This method creates a Flow using different modes from supplied arguments
         */
        static of(){
            if( arguments.length == 0 )
                return FlowFactory.getFlow([]);

            if( arguments.length > 1 )
                return FlowFactory.getFlow(arguments);

            if( arguments.length == 1 && Util.isNumber(arguments[0]) )
                return new IteratorFlow(FlowFactory.createIteratorWithEmptyArraysFromNumber(arguments[0]));

            return FlowFactory.getFlow(arguments[0]);
        }

        /**
         * This creates a Flow from a range of numbers. It is assumed that end > start
         * @param start the start number
         * @param end the end number
         */
        static fromRange(start, end){
            return FlowFactory.getFlow([...new Array(end - start + 1).keys()].map((elem) => elem + start));
        }

        /**
         * This is a direct method to create a Flow from file.
         * @param file the path to the file
         */
        static fromFile(file){
            return new IteratorFlow(FlowFactory.createIteratorFromFileSystem(file));
        }


        //Dummy function to be used by collect
        static toArray(){
            return "toArray";
        }

        //Dummy function to be used by collect
        static toSet(){
            return "toSet"
        }

        //Dummy function to be used by OrderBy
        static ASC(){
            return "ASC";
        }

        //Dummy function to be used by OrderBy
        static DESC(){
            return "DESC";
        }

        //Dummy function to be used by OrderBy
        static NUM_ASC(){
            return "NUM_ASC";
        }

        //Dummy function to be used by OrderBy
        static NUM_DESC(){
            return "NUM_DESC";
        }


        //*******************
        //   FLOW METHODS
        //*******************

        /**
         * This method restricts data operation to a certain number, starting from the first item it can see.
         * @param num the total number of items required.
         */
        limit(num){
            if( num <= 0 )
                throw new Error("Limit value must be greater than 0");

            var flow = new RangeMethodFlow(0, num);
            setRefs(this, flow);

            return flow;
        }

        /**
         * The number of elements to skip in the data stream
         * @param num the number of elements
         */
        skip(num){
            if( num <= 0 )
                throw new Error("Skip value must be greater than 0");

            var flow = new RangeMethodFlow(num, Number.MAX_VALUE);
            setRefs(this, flow);

            return flow;
        }

        /**
         * Skip until the condition in the function argument returns true
         * @param func the function which will test the input and return a boolean
         */
        skipUntil(func){
            if( !Util.isFunction(func) )
                throw new Error("skipUntil requires a function");

            var flow = new SkipTakeWhileUntilFlow(func, 1);
            setRefs(this, flow);

            return flow;
        }

        /**
         * Skip while the condition in the function argument returns true
         * @param func the function which will test the input and return a boolean
         */
        skipWhile(func){
            if( !Util.isFunction(func) )
                throw new Error("skipWhile requires a function");

            var flow = new SkipTakeWhileUntilFlow(func, 2);
            setRefs(this, flow);

            return flow;
        }

        /**
         * Keep accepting the piped data until the condition in the function argument returns true
         * This method also takes the data that meets the condition but skips after
         * @param func the function which will test the input and return a boolean
         */
        takeUntil(func){
            if( !Util.isFunction(func) )
                throw new Error("takeUntil requires a function");

            var flow = new SkipTakeWhileUntilFlow(func, 3);
            setRefs(this, flow);

            return flow;
        }

        /**
         * Keep accepting the piped data while the condition in the function argument returns true
         * @param func the function which will test the input and return a boolean
         */
        takeWhile(func){
            if( !Util.isFunction(func) )
                throw new Error("takeWhile requires a function");

            var flow = new SkipTakeWhileUntilFlow(func, 4);
            setRefs(this, flow);

            return flow;
        }


        /**
         * This create a data window to operate on
         * @param startIndex the starting point/index in the data stream...closely related to the amount of elements to skip
         * @param endIndex the ending point/index in the data stream (exclusive).
         */
        range(startIndex, endIndex){
            if( startIndex < 0 )
                throw new Error("Start Index cannot be negative");
            if( endIndex <= 0 )
                throw new Error("End Index must be greater than 0");
            if( startIndex > endIndex )
                throw new Error("End Index cannot be less than Start Index");

            var flow = new RangeMethodFlow(startIndex, endIndex);
            setRefs(this, flow);

            return flow;
        }

        /**
         * This maps one or more parts of a data...as with Map-Reduce
         * @param func the mapping function
         */
        select(func){
            var flow = new Flow();
            if( Util.isFunction(func) )
                flow.pipeFunc = func;
            else{
                flow.pipeFunc = function(input){
                    return input[func];
                };
            }

            setRefs(this, flow);

            return flow;
        }

        /**
         * alias for select
         * @param func the mapping function
         * @returns {*}
         */
        map(func){
            return this.select(func);
        }

        /**
         * This maps data from one input to many outputs using the input function to generate the collection
         * @param func the function to generate a collection (multiple outputs) from an input
         */
        selectExpand(func){
            var flow = new SelectExpandFlattenMethodFlow(func);
            setRefs(this, flow);

            return flow;
        }

        /**
         * This maps data from one input to many outputs. The input is already a form of collection/iterable supported
         * by Flow.from(...)
         * @returns {*}
         */
        selectFlatten(){
            return this.selectExpand((input) => input);
        }

        /**
         * This does data filtering
         * @param func the filtering function. The function is expected to return a boolean
         */
        where(func){
            var flow = new WhereMethodFlow(func);
            setRefs(this, flow);

            return flow;
        }

        /**
         * Alias for where
         * @param func the filter function
         * @returns {*}
         */
        filter(func){
            return this.where(func);
        }

        static _sort(order){
            return function(a, b){
                if( order == "num_asc" )
                    return a - b;
                else if( order == "num_desc" )
                    return b - a;
                else {
                    if( a < b )
                        return order == "asc" ? -1 : 1;
                    if( a > b )
                        return order == "asc" ? 1 : -1;
                    return 0;
                }
            };
        }

        orderBy(func){
            if( !func )
                func = Flow._sort("asc");

            if( Util.isFunction(func) ) {
                if( func == Flow.ASC )
                    func = Flow._sort("asc");
                else if( func == Flow.DESC )
                    func = Flow._sort("desc");
                else if( func == Flow.NUM_ASC )
                    func = Flow._sort("num_asc");
                else if( func == Flow.NUM_DESC )
                    func = Flow._sort("num_desc");
            }
            else if( Util.isString(func) )
                func = Flow._sort(func.toLowerCase());

            var flow = new OrderByMethodFlow(func);
            setRefs(this, flow);

            return flow;
        }

        partitionBy(keyFunc){
            var groupFunc = keyFunc;
            if( !Util.isFunction(keyFunc) ) {
                groupFunc = function (input) {
                    return input[keyFunc];
                };
            }

            var flow = new PartitionByMethodFlow(groupFunc);
            setRefs(this, flow);

            return flow;
        }


        /**
         * This method discretizes a Flow
         * @param span how many data groups or streams the discretization should span
         * @param length the length of the window from the span
         * @param spawnFlows if the discretization should span array elements or DiscreteFlows
         */
        discretize(span, length, spawnFlows){
            if( spawnFlows === undefined )  //if this argument was not specified, we default to true
                spawnFlows = true;

            var flow = new DiscretizerFlow(span, getDataEndObject(length), spawnFlows);
            setRefs(this, flow);

            this.isDiscretized = true;

            return flow;
        }


        //*******************
        //   FLOW ACTIONS
        //*******************

        /**
         * Counts the items visible at the last Flow
         * @returns {number} the total number of items found
         */
        count(){
            var total = 0;
            var temp, _next;
            _next = this.next;
            this.next = null;

            while( (temp = this.process()) != null )
                total++;

            this.next = _next;

            return total;
        }

        //Function to be used by collect
        static toMap(keyFunc){
            var groupFunc = keyFunc;
            if( !Util.isFunction(keyFunc) ) {
                groupFunc = function (input) {
                    return input[keyFunc];
                };
            }

            return groupFunc;
        }

        _toSet(){
            var set = new Set();
            var data, _next;
            _next = this.next;
            this.next = null;

            while( (data = this.process()) != null )
                set.add(data);

            this.next = _next;

            return set;
        }

        _toArray(){
            var array = [];
            var data, _next;
            _next = this.next;
            this.next = null;

            while( (data = this.process()) != null )
                array.push(data);

            this.next = _next;

            return array;
        }

        /**
         * This method groups items into groups and returns the grouped data
         * @param keyFunc the key to use for the grouping or a function that returns the group, given an input
         * @returns {{}}
         */
        groupBy(keyFunc){
            var groupFunc = keyFunc;
            if( !Util.isFunction(keyFunc) ) {
                groupFunc = function (input) {
                    return input[keyFunc];
                };
            }

            var data, group, groups = {}, _next;
            _next = this.next;
            this.next = null;

            while( (data = this.process()) != null ){
                group = groupFunc(data);
                if( !groups[group] )
                    groups[group] = [];

                groups[group].push(data);
            }

            this.next = _next;

            return groups;
        }

        /**
         * Join outputs by a delimiter and return a string
         * @param delim Optional delimiter. If none is provided, comma (,) is used
         * @returns {string} the joined string
         */
        join(delim){
            if( !delim )
                delim = ",";

            var joined = "", index = 0;
            var data, _next;
            _next = this.next;
            this.next = null;

            while( (data = this.process()) != null ) {
                if( index > 0 )
                    joined += delim;
                joined += data;
                index++;
            }

            this.next = _next;

            return joined;
        }


        /**
         * This method allows data collation to either an Array or a Set...a Map will be possible later
         * @param func either Flow.toArray or Flow.toSet
         * @returns {*} the data in the required format
         */
        collect(func){
            if( !func )
                return this._toArray();

            let isMap = false;

            if( Util.isFunction(func) ) {
                if( func == Flow.toArray )
                    return this._toArray();
                if( func == Flow.toSet )
                    return this._toSet();

                //this probably has to be collecting to a map
                isMap = true;
            }
            else if( Util.isString(func) ){
                if( func.toLowerCase() == "toarray" )
                    return this._toArray();
                if( func.toLowerCase() == "toset" )
                    return this._toSet();

                //this probably has to be collecting to a map
                isMap = true;
            }

            if( isMap ){
                let map = new Map();
                Flow.from(this.groupBy(func)).foreach((pair) => map.set(pair.key, pair.value));
                return map;
            }

            //use toArray as Default
            return this._toArray();
        }

        /**
         * This allows a custom operation on the data elements seen at the last Flow
         * @param func the custom function to operate on each element of the data collection
         */
        foreach(func){
            var data, _next;
            _next = this.next;
            this.next = null;

            while( (data = this.process()) != null )
                func(data);

            this.next = _next;
        }

        /**
         * Alias of foreach for those familiar with the JS forEach
         * @param func
         */
        forEach(func){
            this.foreach(func);
        }

        anyMatch(func){
            var data, _next;
            _next = this.next;
            this.next = null;

            while( (data = this.process()) != null ){
                if( func(data) )
                    return true;
            }

            this.next = _next;

            return false;
        }

        allMatch(func){
            var data, _next;
            _next = this.next;
            this.next = null;

            while( (data = this.process()) != null ){
                if( !func(data) )
                    return false;
            }

            this.next = _next;

            return true;
        }

        noneMatch(func){
            return !this.anyMatch(func);
        }

        findFirst(){
            var obj, _next;
            _next = this.next;
            this.next = null;

            obj = this.process();

            this.next = _next;

            return obj;
        }

        findAny(){
            return this.findFirst();
        }

        findLast(){
            var data, found = null, _next;
            _next = this.next;
            this.next = null;

            while( (data = this.process()) != null )
                found = data;

            this.next = _next;

            return found;
        }

        sum(){
            var data, sum = 0, _next;
            _next = this.next;
            this.next = null;

            while( (data = this.process()) != null )
                sum += data;

            this.next = _next;

            return sum;
        }

        max(){
            var data, max = null, _next;
            _next = this.next;
            this.next = null;

            while( (data = this.process()) != null ){
                if( max == null || data > max )
                    max = data;
            }

            this.next = _next;

            return max;
        }

        min(){
            var data, min = null, _next;
            _next = this.next;
            this.next = null;

            while( (data = this.process()) != null ){
                if( min == null || data < min )
                    min = data;
            }

            this.next = _next;

            return min;
        }

        average(){
            var data, sum = 0, count = 0, _next;
            _next = this.next;
            this.next = null;

            while( (data = this.process()) != null ){
                sum += data;
                count++;
            }

            this.next = _next;

            return sum / count;
        }

        reduce(init, func){
            var data, temp = init, _next;
            _next = this.next;
            this.next = null;

            while( (data = this.process()) != null )
                temp = func(temp, data);

            this.next = _next;

            return temp;
        }

        _addElement(elem){
            if( !this.rootFlow.shouldCache )    //if caching is not supported for this Flow chain
                return;

            if( !this.rootFlow.isStream() && !this.ended ) { //only save if we are not streaming and we have not ended the first iteration
                if( elem == null ){ //check if we have gotten to the end
                    this.ended = true;
                    return;
                }
                this.elements.push(elem);
            }
        }

        _getElement(){
            var obj;
            try {
                obj = this.elemPos < this.elements.length ? this.elements[this.elemPos] : null;
                return obj;
            }
            finally{
                this.elemPos++;
                if( obj == null )
                    this.elemPos = 0;
            }
        }
    }

    /**
     * This function is used to set the linked references for Flows (like LinkedLists)
     * @param primary the current Flow
     * @param secondary the newly created Flow based on the primary
     */
    function setRefs(primary, secondary){
        secondary.prev = primary;
        primary.next = secondary;

        secondary.rootFlow = primary.rootFlow;
    }


    /**
     * This is the first Flow that will be created from the data types and does most of the heavy lifting.
     * One major difference between this class and the Flow class is that the process method in this class
     * does same thing as the pipe method in the Flow class
     */
    class IteratorFlow extends Flow{
        /**
         * @param iterator a JS Iterator object (could be a generator)
         */
        constructor(iterator){
            super();
            this.iterators = [];
            this.iterators.push(iterator);
            this.rootFlow = this;
            this.pos = 0;
            this.isListening = false;   //If this has started listening for new data (push mode)
            this.subscribers = {};  //the streamer-key/function map of function which will be called when a new data is received on the stream

            this.streamElements = [];   //This is where we will store the stream elements till we get to the window end
            this.discreteStreamLength = 1;  //The number of streams (streamer objects) to iterate through for the discretization
            this.isDataEndObject = {isDataEnd: (data) => false};   //A object that implements the isDataEnd The function to check if we have gotten to the end of a discrete stream
            this.recall = {};   //any variable that needs to be remembered will plug in here.

            //For ParallelFlow (*still under design*)
            this.isParallel = false;    //If this IteratorFlow is under a ParallelFlow instance
            this.pFlow = null;  //A reference to the parallel flow housing this iterator flow (if any)

            this.shouldCache = true;    //If the Flows should save processed data
        }

        /**
         * This method is used to determine if data is pushed on this IteratorFlow as a stream
         * @returns boolean a value that determines if this Flow is for stream processing
         */
        isStream(){
            return this.iterators.length > 0 && this.iterators[0].streamer && Util.isStreamer(this.iterators[0].streamer);
        }

        /**
         * The process method will act like the pipe method in the default Flow class (but without an input)
         */
        process(){
            if (this.pos >= this.iterators.length) {
                this.pos = 0;
                return null;
            }

            if( !this.isDiscretized ) {
                //##go through the iterators one after the other##

                //get the data from the current iterator
                var obj = this.iterators[this.pos].next();

                //check for the next iterator that has data
                while (obj.done && this.pos < this.iterators.length) {
                    this.pos++;
                    if (this.pos >= this.iterators.length)
                        break;

                    obj = this.iterators[this.pos].next();
                }

                if (obj.done) {
                    this.pos = 0;
                    return null;
                }

                if (this.next !== null)
                    return this.next.pipe(obj.value);
                return obj.value;
            }
            else{//for discretized flows
                //we use this instead of the streamElements cause we don't need to save state.
                //Also, clearing streamElements could affect implementations storing the output
                var streamData = [];

                //ensure that our discrete stream length is not more than the number of iterators we have
                this.discreteStreamLength = Math.min(this.discreteStreamLength, this.iterators.length);

                if( this.discreteStreamLength == 1 ){//operate on one stream first and then move to the next
                    obj = this.iterators[this.pos].next();

                    //check for the next iterator that has data
                    while (obj.done && this.pos < this.iterators.length) {
                        this.pos++;
                        if (this.pos >= this.iterators.length)
                            break;

                        obj = this.iterators[this.pos].next();
                    }

                    if (obj.done) {
                        this.pos = 0;
                        return null;
                    }

                    while( !obj.done ){
                        streamData.push(obj.value);

                        if( this.isDataEndObject.isDataEnd(obj.value, streamData.length) ){
                            if (this.next !== null)
                                return this.next.pipe(streamData);
                            return streamData;
                        }

                        obj = this.iterators[this.pos].next();
                    }

                    //At this point, if we have elements in the stream, we fill it will nulls since we are instructed to
                    //discretize with one iterator
                    if( streamData.length > 0 ){
                        while(true) {
                            streamData.push(null);
                            if( this.isDataEndObject.isDataEnd(obj.value, streamData.length) ){
                                if (this.next !== null)
                                    return this.next.pipe(streamData);
                                return streamData;
                            }
                        }
                    }
                }
                else{
                    if( !this.recall.ended ) {
                        this.recall.ended = []; //we need this since the iterators reset...we need to know the ones that have ended
                        //a flag that states if the last check was data end. Because we cannot peek into the iterator, we have to
                        //waste one round of iteration to discover that they have all ended which will create null data.
                        this.recall.justEnded = false;

                        for (let i = 0; i < this.discreteStreamLength; i++) {
                            this.recall.ended.push(false);
                        }
                    }

                    do{
                        //check if all items have ended
                        if( this.recall.justEnded && Flow.from(this.recall.ended).allMatch((input) => input) )
                            break;

                        var pack = [];

                        for(let i = 0; i < this.discreteStreamLength; i++){
                            if( this.recall.ended[i] )
                                pack[i] = null;
                            else {
                                obj = this.iterators[i].next();
                                if( obj.done ) {
                                    this.recall.ended[i] = true;
                                    pack[i] = null;
                                }
                                else
                                    pack[i] = obj.value;
                            }
                        }

                        //check if we just ended on the last iteration and this current sets of data are just nulls
                        if( this.recall.justEnded && Flow.from(pack).allMatch((input) => input == null) )
                            break;

                        this.streamElements.push(pack);

                        if( this.isDataEndObject.isDataEnd(pack, this.streamElements.length) ){
                            this.recall.justEnded = true;

                            try {
                                if (this.next !== null)
                                    return this.next.pipe(this.streamElements.slice());
                                return this.streamElements.slice();
                            }
                            finally{
                                this.streamElements = [];
                            }
                        }
                        else
                            this.recall.justEnded = false;
                    }while(true);

                    this.pos = 0;    //reset the pos variable to allow for reuse

                    //clear temp fields
                    delete this.recall.ended;
                    delete this.recall.justEnded;
                    //reset temp stream storage variable
                    this.streamElements = [];

                    return null;
                }
            }
        }

        /**
         * This methods merges another data input on the current stream. It is only available to IteratorFlow
         * We can not merge Streamers with other data types
         * @param data the object to create an IteratorFlow from (more like the output from 'Flow.from')
         */
        merge(data){
            var isStream = this.isStream();

            var iterator = FlowFactory.getIterator(data);
            //ensure that we cannot mix streams and static data structures
            if( (!isStream && iterator.streamer)
                || (isStream && !iterator.streamer) )
                throw new Error("Streamer cannot be merged with other data types");

            this.iterators.push(iterator);

            return this;
        }

        startPush(){
            if( this.isListening )
                return;

            this.isListening = true;

            if( this.isStream() )  //if this is a Streamer
                this._listen();
            else
                this._doPush();
        }

        stopPush(){
            if( !this.isListening )
                return;

            this.isListening = false;

            if( this.isStream() ){ //if this is a Streamer
                for( let iterator of this.iterators )
                    unsubscribeFromStream(iterator.streamer, this);
            }
        }

        /**
         * This method is used by OutFlow to trigger the start of a push flow for finite data and for JS generators
         */
        _doPush(){//This works best for streaming from filesystem (since it is static/finite) and JS generators too...
            var obj;

            if( !this.isDiscretized ) {
                while(true) {
                    if (!this.isListening || this.pos >= this.iterators.length)
                        break;
                    //get the data from the current iterator
                    obj = this.iterators[this.pos].next();

                    //check for the next iterator that has data
                    while (obj.done && this.pos < this.iterators.length) {
                        this.pos++;
                        if (this.pos >= this.iterators.length)
                            break;

                        obj = this.iterators[this.pos].next();
                    }

                    if (obj.done)
                        break;

                    this.push(obj.value);
                }
            }
            else{//for discretized flows
                //ensure that our discrete stream length is not more than the number of iterators we have
                this.discreteStreamLength = Math.min(this.discreteStreamLength, this.iterators.length);

                if( this.discreteStreamLength == 1 ){//operate on one stream first and then move to the next
                    do{
                        obj = this.iterators[this.pos].next();
                        while( !obj.done ){
                            this.streamElements.push(obj.value);

                            if( this.isDataEndObject.isDataEnd(obj.value, this.streamElements.length) ){
                                this.push(this.streamElements.slice());
                                this.streamElements = [];
                            }

                            obj = this.iterators[this.pos].next();
                        }

                        //At this point, if we have elements in the stream, we fill it will nulls since we are instructed to
                        //discretize with one iterator
                        if( this.streamElements.length > 0 ){
                            while(true) {
                                this.streamElements.push(null);
                                if( this.isDataEndObject.isDataEnd(obj.value, this.streamElements.length) ){
                                    this.push(this.streamElements.slice());
                                    this.streamElements = [];
                                    break;
                                }
                            }
                        }

                        this.pos++;
                    }while( this.pos < this.iterators.length );
                }
                else{
                    var ended = []; //we need this since the iterators reset...we need to know the ones that have ended
                    //a flag that states if the last check was data end. Because we cannot peek into the iterator, we have to
                    //waste one round of iteration to discover that they have all ended which will create null data.
                    var justEnded = false;

                    for(let i = 0; i < this.discreteStreamLength; i++){
                        ended.push(false);
                    }

                    do{
                        var pack = [];

                        for(let i = 0; i < this.discreteStreamLength; i++){
                            if( ended[i] )
                                pack[i] = null;
                            else {
                                obj = this.iterators[i].next();
                                if( obj.done ) {
                                    ended[i] = true;
                                    pack[i] = null;
                                }
                                else
                                    pack[i] = obj.value;
                            }
                        }

                        //check if we just ended on the last iteration and this current sets of data are just nulls
                        if( justEnded && Flow.from(pack).allMatch((input) => input == null) )
                            break;

                        this.streamElements.push(pack);

                        if( this.isDataEndObject.isDataEnd(pack, this.streamElements.length) ){
                            justEnded = true;
                            this.push(this.streamElements.slice());
                            this.streamElements = [];

                            //check if all items have ended
                            if( Flow.from(ended).allMatch((input) => input) )
                                break;
                        }
                        else
                            justEnded = false;
                    }while(true);
                }
            }

            this.isListening = false;   //we done processing so stop listening
            this.pos = 0;   //reset the pos for other operations
        }

        /**
         * Register to listen for data changes in streamers and push elements through the Flow chain
         * This method is called by startPush when the push operation is required to start listening for
         * data changes in the streamers
         */
        _listen(){
            if( this.isDiscretized ) {//for discretized flows...maintain the subscription state for consistency
                var streamers = [];   //the order with which we should arrange data in discretized flows

                for (let iterator of this.iterators) {
                    if (iterator.streamer) {
                        streamers.push(iterator.streamer);
                        subscribeToStream(iterator.streamer, this);
                    }
                }

                //set up the basics for a discretized push
                //this.recall.streamers = streamers;  //save the order in recall
                this.recall.streamKeys = Flow.from(streamers).select((streamer) => streamer.key).collect(Flow.toArray);
                this.recall.queues = Flow.from(streamers).select((streamer) => new Queue()).collect(Flow.toArray);
                this.discreteStreamLength = Math.min(streamers.length, this.discreteStreamLength);    //ensure minimum
                this.recall.ready = true;   //a flag that ensures we do not have more than one setTimeout function in queue
                this.recall.called = false; //if we have called the setTimeout function at least once
                this.streamElements = [];
            }
            else{//subscribe to Streamers
                for (let iterator of this.iterators) {
                    if( iterator.streamer )
                        subscribeToStream(iterator.streamer, this);
                }
            }
        }

        _prePush(input, streamer){
            if( !this.isDiscretized )
                this.push(input);
            else{//for discretized streams
                //add item to queue
                this.recall.queues[this.recall.streamKeys.indexOf(streamer.key)].enqueue(input);

                var self = this;

                if( !this.recall.ready )
                    return;

                this.recall.ready = false;

                //use a set timeout to allow opportunity for several push
                setTimeout(function(){
                    Outer:
                        do {
                            //check if we have enough for a push
                            var pack = [];
                            for (let i = 0; i < self.discreteStreamLength; i++) {
                                if (self.recall.queues[i].isEmpty())
                                    break Outer;

                                pack.push(self.recall.queues[i].dequeue());
                            }

                            self.streamElements.push(pack);

                            if (self.isDataEndObject.isDataEnd(pack, self.streamElements.length)) {
                                self.push(self.streamElements.slice());
                                self.streamElements = [];
                            }
                        }
                        while(true);

                    self.recall.called = true;
                    self.recall.ready = true;
                }, this.recall.called ? 0 : 1000);  //wait a second before the first start to allow for old data to pass through
            }
        }

        push(input){
            if( !this.isListening )//if we are to stop listening for push data
                return;

            this.next !== null ? this.next.push(input) : this.terminalFunc(input);
        }

        /**
         * This method makes the IteratorFlow discretizable.
         * @param span The number of streams/iterators to look at in the window.
         *      'streams' value of 1 means that we focus on only one stream for the window size and move to the next stream.
         *      'streams' value greater than 1 means that we should do a round-robin based on the specified number
         *          and then move to the next stream(s) and do the same, operating on the data based on the specified length
         * @param spanLength The window length. The length of data to be treated as one (a block).
         *      The length could be a function that determines when we have gotten to the last item.
         *      This could be used for custom time-based discretization. So data could be split based on time.
         * @param spawnFlows if we should spawn DiscreteFlows as output
         */
        discretize(span, spanLength, spawnFlows){
            if( spawnFlows === undefined )
                spawnFlows = true;

            this.discreteStreamLength = span;
            this.isDataEndObject = getDataEndObject(spanLength);
            this.isDiscretized = true;

            var flow = new DiscretizerFlow(span, this.isDataEndObject, spawnFlows);
            setRefs(this, flow);

            return flow;
        }
    }

    /**
     * This method subscribes a Flow (IteratorFlow) to a Streamer to listen for data changes
     * This method is placed outside the class to prevent external access
     * @param streamer the Streamer to subscribe to
     * @param flow the IteratorFlow object which will initiate the push
     */
    function subscribeToStream(streamer, flow){
        var func = function(data){
            setTimeout(() => flow._prePush(data, streamer), 0);
        };

        streamer.subscribe(func);
        flow.subscribers[streamer.key] = func;
    }

    function unsubscribeFromStream(streamer, flow){
        if( flow.subscribers[streamer.key] ) {
            streamer.unsubscribe(flow.subscribers[streamer.key]);
            delete flow.subscribers[streamer.key];    //delete this streamer handle from the subscribers list
        }
    }

    function getDataEndObject(spanLength){
        var obj;

        if( Util.isNumber(spanLength) ){
            obj = (function(l){
                var length = l;
                var pos = 0;

                return {
                    /**
                     *
                     * @param data is the data that has just been added
                     * @param dataLength this is the current length of the array holding the discretized data
                     * @returns {boolean}
                     */
                    isDataEnd: function(data, dataLength){
                        try {
                            if (pos < length - 1)
                                return false;
                            else{
                                pos = -1;
                                return true;
                            }
                        }
                        finally{
                            pos++;
                        }
                    }
                };
            })( Math.ceil(spanLength) );
        }
        else if( Util.isFunction(spanLength) ){
            obj = (function(lengthFunc){
                return {
                    isDataEnd: lengthFunc
                };
            })(spanLength);
        }
        else if( spanLength.isDataEnd && Util.isFunction(spanLength.isDataEnd) )
            obj = spanLength;
        else
            throw new Error("Span length can be either a Number, a function or an object with an 'isDataEnd' function");

        return obj;
    }




    /**
     * This class is used to create Flows that flatten and expand data based on selectFlatten and selectExpand respectively
     */
    class SelectExpandFlattenMethodFlow extends Flow{
        /**
         *
         * @param func a function that uses the input to generate a data collection that is supported by Flow.from(...)
         */
        constructor(func){
            super();
            this.pipeFunc = func;
            this.iteratorFlow = null;   //This is just used as an iterator for the the generated collection.
        }

        process(){
            if( this.ended )
                return this._getElement();

            //establish link from parent to this Flow
            if( this.prev.next != this )//if the parent was linked to another Flow, bring back the link
                this.prev.next = this;

            var obj;

            if( this.iteratorFlow == null ) {
                obj = this.prev.process();
                if( obj == null )
                    this._addElement(null);
                return obj;
            }

            obj = this.iteratorFlow.process();
            if( obj == null ){
                this.iteratorFlow = null;
                obj = this.prev.process();
                if( obj == null )
                    this._addElement(null);
                return obj;
            }

            this._addElement(obj);

            if( this.next !== null )
                return this.next.pipe(obj);

            return obj;
        }

        pipe(input){
            this.iteratorFlow = Flow.from(this.pipeFunc(input));

            return this.process();
        }

        push(input){
            this.iteratorFlow = Flow.from(this.pipeFunc(input));

            var output;
            while( (output = this.process()) != null ){
                this.next !== null ? this.next.push(output) : this.terminalFunc(output);
            }
        }
    }


    /**
     * This class is used for the Flow methods: skip, limit & range.
     * It is used to limit/restrict the data that would be processed...more like creating a data window.
     */
    class RangeMethodFlow extends Flow{
        /**
         *
         * @param startIndex the index to start from (inclusive)
         * @param endIndex the index to end (exclusive)
         */
        constructor(startIndex, endIndex){
            super();
            this.start = startIndex;
            this.end = endIndex;
            this.position = 0;
        }

        pipe(input){
            if (this.position < this.end) {
                this.position++;

                if (this.position <= this.start) {
                    var obj = this.prev.process();
                    if(obj == null)
                        this._addElement(null);

                    return obj;
                }

                this._addElement(input);

                if (this.next !== null)
                    return this.next.pipe(input);
                else
                    return input;
            }
            else {
                //reset the position for reuse
                this.position = 0;

                this._addElement(null);
                return null;
            }
        }

        push(input){
            if( this.position < this.end ){
                this.position++;

                if( this.position <= this.start || this.position >= this.end ) {
                    return;
                }

                this.next !== null ? this.next.push(input) : this.terminalFunc(input);
            }
        }
    }





    /**
     * The where method (filter) class Flow definition
     */
    class WhereMethodFlow extends Flow{
        constructor(func){
            super();
            this.pipeFunc = func;
        }

        pipe(input){
            var outcome = this.pipeFunc(input);

            if( !outcome )
                return this.prev.process();

            this._addElement(input);

            if( this.next !== null )
                return this.next.pipe(input);

            return input;
        }

        push(input){
            var outcome = this.pipeFunc(input);

            if( !outcome ) {
                return;
            }

            this.next !== null ? this.next.push(input) : this.terminalFunc(input);
        }
    }


    /**
     * The orderBy method class Flow definition
     */
    class OrderByMethodFlow extends Flow{
        constructor(func){
            super();
            this.pipeFunc = func;
            this.items = [];    //the items to sort
            this.obtainedAll = false;
            this.pos = 0;
        }

        process(){
            if( this.ended )
                return this._getElement();

            //establish link from parent to this Flow
            if( this.prev.next != this )//if the parent was linked to another Flow, bring back the link
                this.prev.next = this;

            var obj;

            if( !this.obtainedAll ){
                obj = this.prev.process();
                if (obj != null)
                    return obj;

                this.obtainedAll = true;

                this.items.sort(this.pipeFunc);
            }

            //at this point we have obtained all
            if( this.pos < this.items.length )
                obj = this.items[this.pos++];
            else{
                //save the items for reuse
                this.elements = this.items.slice();
                this.ended = true;
                this.elemPos = 0;

                //reset items for restarting
                this.pos = 0;
                this.items = [];
                this.obtainedAll = false;

                return null;
            }

            if( this.next !== null )
                return this.next.pipe(obj);
            return obj;
        }

        pipe(input){
            this.items.push(input);
            return this.process();
        }

        //we cannot sort in a push
        push(input){
            this.next !== null ? this.next.push(input) : this.terminalFunc(input);
        }
    }


    /**
     * The partitionBy method class Flow definition
     */
    class PartitionByMethodFlow extends Flow{
        constructor(func){
            super();
            this.pipeFunc = func;
            this.partitions = {};
            this.obtainedAll = false;
            this.iterator = null;   //used for iterating through the partitions
        }

        process(){
            if( this.ended )
                return this._getElement();

            //establish link from parent to this Flow
            if( this.prev.next != this )//if the parent was linked to another Flow, bring back the link
                this.prev.next = this;

            var obj;

            if( !this.obtainedAll ){
                obj = this.prev.process();
                if (obj != null)
                    return obj;

                this.obtainedAll = true;

                this.iterator = FlowFactory.createIteratorFromObject(this.partitions);
            }

            obj = this.iterator.next();
            if( obj.done ){
                this._addElement(null);

                //reset for reusing
                this.iterator = null;
                this.obtainedAll = false;
                return null;
            }

            obj = obj.value;

            this._addElement(obj);

            if( this.next !== null )
                return this.next.pipe(obj);
            return obj;
        }

        pipe(input){
            var partition = this.pipeFunc(input);
            if( !this.partitions[partition] )
                this.partitions[partition] = [];
            this.partitions[partition].push(input);

            return this.process();
        }

        //one of two options for push: we either simply let the data pass through or
        //we apply the group functions and send the data on as an object with {group: name, data: input}
        //going with the first till i hear/feel otherwise.
        push(input){
            this.next !== null ? this.next.push(input) : this.terminalFunc(input);
        }
    }

    /**
     * This class is responsible for the following methods:
     * skipUntil, skipWhile, takeUntil, takeWhile
     */
    class SkipTakeWhileUntilFlow extends Flow{
        constructor(func, method){
            super();
            this.pipeFunc = func;
            this.method = method;   //1=skipUntil, 2=skipWhile, 3=takeUntil, 4=takeWhile
            this.finished = false;
        }

        pipe(input){
            var obj;

            switch(this.method){
                case 1: //skipUntil
                    if( this.finished || this.pipeFunc(input) ) {//condition has been met for skipUntil...we no longer skip
                        this.finished = true;   //flag that we do not need to check the pipe function test
                        obj = input;
                    }
                    else {
                        obj = this.prev.process();
                        if (obj == null)
                            this._addElement(obj);
                        return obj;
                    }
                    break;
                case 2: //skipWhile
                    if( !this.finished && this.pipeFunc(input) ){
                        obj = this.prev.process();
                        if (obj == null)
                            this._addElement(obj);
                        return obj;
                    }
                    else{
                        this.finished = true;   //flag that we do not need to check the pipe function test
                        obj = input;
                    }
                    break;
                case 3: //takeUntil
                    if( this.finished || this.pipeFunc(input) ){
                        if( !this.finished )    //also take the one that meets the condition
                            obj = input;
                        else
                            obj = null;
                        this.finished = true;
                    }
                    else
                        obj = input;
                    break;
                case 4: //takeWhile
                    if( !this.finished && this.pipeFunc(input) )
                        obj = input;
                    else{
                        this.finished = true;
                        obj = null;
                    }
            }

            this._addElement(obj);

            if (obj == null) {
                this.finished = false;  //reset for reuse
                return null;
            }

            if( this.next !== null )
                return this.next.pipe(obj);
            return obj;
        }

        push(input){
            var obj;

            switch(this.method){
                case 1: //skipUntil
                    if( this.finished || this.pipeFunc(input) ) {//condition has been met for skipUntil...we no longer skip
                        this.finished = true;   //flag that we do not need to check the pipe function test
                        obj = input;
                    }
                    else
                        return;
                    break;
                case 2: //skipWhile
                    if( !this.finished && this.pipeFunc(input) )
                        return;
                    else{
                        this.finished = true;   //flag that we do not need to check the pipe function test
                        obj = input;
                    }
                    break;
                case 3: //takeUntil
                    if( this.finished || this.pipeFunc(input) ){
                        if( !this.finished ) {    //also take the one that meets the condition
                            obj = input;
                            this.finished = true;
                        }
                        else
                            return;
                    }
                    else
                        obj = input;
                    break;
                case 4: //takeWhile
                    if( !this.finished && this.pipeFunc(input) )
                        obj = input;
                    else{
                        this.finished = true;
                        return;
                    }
            }

            this.next !== null ? this.next.push(obj) : this.terminalFunc(obj);
        }
    }


    /**
     * The job of this class is to create DiscretizedFlows
     */
    class DiscretizerFlow extends Flow{
        constructor(span, isDataEndObject, spawnFlows){
            super();
            this.span = span > 0 ? span : 1;
            this.isDataEndObject = isDataEndObject; //the object with the function that allows us to determine if we have gotten to the end of a window
            this.spawnFlows = spawnFlows;
            this.items = [];  //this are saved data which are used to create a Discretized Flow
        }

        /**
         * This is to make sure the Flow never gets to the ended state for cached processed
         * @returns {*}
         */
        process(){
            if( this.prev.next != this )//if the parent was linked to another Flow, bring back the link
                this.prev.next = this;

            return this.prev.process();
        }

        pipe(input){
            if( this.prev instanceof IteratorFlow && !this.isDiscretized ) //Don't do any more work...it has been discretized from IteratorFlow
                this.items = input;
            else {
                var toAdd = input;

                if (this.span == 1) {
                    this.items.push(toAdd);

                    //check if we have gotten to the end of a discrete flow.
                    if (!this.isDataEndObject.isDataEnd(toAdd, this.items.length))
                        return this.prev.process();
                }
                else {
                    if (!Util.isArray(input)) {
                        var iteratorFlow = FlowFactory.getFlow(input);
                        toAdd = [];
                        var seenNull = false, item;
                        for (let i = 0; i < this.span; i++) {
                            if (seenNull)
                                toAdd.push(null);
                            else {
                                item = iteratorFlow.process();
                                toAdd.push(item);
                                //the implementation of Flow allows resetting after a Null so we need this to avoid it restarting
                                //from the beginning after a null
                                if (item == null)
                                    seenNull = true;
                            }
                        }
                        iteratorFlow = null;
                    }
                    else {//regularize the array to be same size as span
                        if (this.span < toAdd.length)
                            toAdd.splice(this.span);
                        else if (this.span > toAdd.length) {
                            while (this.span != toAdd.length)
                                toAdd.push(null);
                        }
                    }

                    this.items.push(toAdd);

                    if (!this.isDataEndObject.isDataEnd(toAdd, this.items.length))
                        return this.prev.process();
                }
            }

            var obj;
            if( this.spawnFlows )
                obj = new DiscretizedFlow(this.items);
            else
                obj = this.items;

            try {
                if (this.next !== null)
                    return this.next.pipe(obj);

                return obj;
            }
            finally{
                this.items = [];
            }
        }

        push(input){
            if( this.prev instanceof IteratorFlow && !this.isDiscretized ) //Don't do any more work...it has been discretized from IteratorFlow
                this.items = input;
            else {
                var toAdd = input;

                if (this.span == 1) {
                    this.items.push(input);

                    //check if we have gotten to the end of a discrete flow.
                    if (!this.isDataEndObject.isDataEnd(input, this.items.length))
                        return;
                }
                else {
                    if (!Util.isArray(input)) {
                        var iteratorFlow = FlowFactory.getFlow(input);
                        toAdd = [];
                        var seenNull = false, item;
                        for (let i = 0; i < this.span; i++) {
                            if (seenNull)
                                toAdd.push(null);
                            else {
                                item = iteratorFlow.process();
                                toAdd.push(item);
                                //the implementation of Flow allows resetting after a Null so we need this to avoid it restarting
                                //from the beginning after a null
                                if (item == null)
                                    seenNull = true;
                            }
                        }
                        iteratorFlow = null;
                    }
                    else {//regularize the array to be same size as span
                        if (this.span < toAdd.length)
                            toAdd.splice(this.span);
                        else if (this.span > toAdd.length) {
                            while (this.span != toAdd.length)
                                toAdd.push(null);
                        }
                    }

                    this.items.push(toAdd);

                    if (!this.isDataEndObject.isDataEnd(toAdd, this.items.length))
                        return;
                }
            }

            var obj;
            if( this.spawnFlows )
                obj = new DiscretizedFlow(this.items);
            else
                obj = this.items;

            if (this.next !== null)
                this.next.push(obj);
            else
                this.terminalFunc(obj);

            this.items = [];
        }
    }

    class DiscretizedFlow extends IteratorFlow{
        /**
         *
         * @param elements an array of elements from the DiscretizerFlow
         */
        constructor(elements){
            super(FlowFactory.createIteratorFromArray(elements));
            this.elements = elements;
        }

        elementSize(){
            return this.elements.length;
        }

        streamSize(){
            try {
                return this.elements[0].length;
            }
            catch(e){
                return 1;
            }
        }
    }


    /**
     * This will be like a readable stream in node.js
     */
    class InFlow extends Flow{
        constructor(streamer){
            super();

            streamer.subscribe(this);
        }

        /**
         * This method receives streams of data from the Streamer subscription
         * @param data a stream data
         */
        notify(data){
            this.push(data);
        }

        //regularize InFlow if it is chained for piping
        process(){
            return null;
        }
    }


    /**
     * This will be like a writable stream in node.js
     */
    class OutFlow extends Flow{
        /**
         *
         * @param source This is the Flow that this OutFlow is based on. The Flow can wrap a FileSystem
         * @param streamer This is the Streamer object which will receive the stream contents from the OutFlow
         * @param key An optional identifier for this OutFlow. If not provided one is generated.
         */
        constructor(source, streamer, key){
            super();

            if( !(source instanceof Flow) )//check if source is a Flow
                throw new Error("Source is NOT a Flow");

            if( !Util.isStreamer(streamer) )//check if streamer is a Flow
                throw new Error("`streamer` is not a Streamer");

            this.streamer = streamer ? streamer : new Streamer();
            this.key = key ? key : Util.generateUUID();    //For identification. Could be used in the Streamer

            this.source = source;
            setRefs(source, this);  //Create a link from the source flow to this flow so that we receive push data
            this.pipeFunc = (input) => input;   //Create a default function to regularize the Flow design
        }

        start(){
            this.rootFlow.startPush();
        }

        stop(){
            this.rootFlow.stopPush();
        }

        push(input){
            this.streamer.push(input, this.key);
        }
    }


    /**
     * This class is used by both IteratorFlow, Inflow & OutFlow for data streaming.
     * You are expected to extends this class and provide implementation of how data would be streamed
     * through your Application
     */
    class Streamer{
        /**
         * Constructor
         * @param func An optional receiver function that gets called when data is available at the OutFlow end
         */
        constructor(func){
            this.listeners = [];
            this.receiver = func && Util.isFunction(func) ? func : null;
            this.key =  Util.generateUUID();    //for identification purposes...particularly used in the IteratorFlow
        }

        /**
         * This method would be called by the OutFlow each time data is available at the Flow chain end.
         * If a receiver is specified in the constructor, the receiver would be sent the data each time it arrives
         * otherwise, you will need to override this class to specify your implementation
         * @param input The data pushed from the OutFlow
         * @param key The key of the OutFlow sending this data
         */
        push(input, key){
            if( this.receiver != null )
                this.receiver(input, key);
        }

        /**
         * This will be used to subscribe a listener for data streams
         * @param listener the function or object to be notified of new data
         */
        subscribe(listener){
            if( (listener.notify && Util.isFunction(listener.notify)) || Util.isFunction(listener) )
                this.listeners.push(listener);
            else
                throw new Error("Listener object must either be a function or an object with a `notify` function.");
        }

        /**
         * This method should be called by your internal implementation to send data to listeners
         * like the InFlow and/or IteratorFlow
         * @param data the data to be sent all available listeners
         * @private
         */
        send(data){
            Flow.from(this.listeners).where(listener => listener.notify && Util.isFunction(listener.notify)).foreach(listener => listener.notify(data));
            Flow.from(this.listeners).where(listener => !(listener.notify && Util.isFunction(listener.notify)) && Util.isFunction(listener)).foreach(listener => listener(data));
        }

        /**
         * This method will be used by the InFlow/IteratorFlow to unsubscribe from receiving stream data.
         * When stopPush is called on element of the Flow chain
         * @param listener
         */
        unsubscribe(listener){
            let index = this.listeners.indexOf(listener);
            if( index >= 0 )
                this.listeners.splice(index, 1);
        }

        /**
         * If Streamer needs to be used in pull mode. It could be the case that streamed data is cached and needs to be
         * processed later as a finite data structure. This methods returns the total number of items available
         * @returns {number} the size of elements
         */
        size(){
            return 0;
        }

        /**
         * Also If Streamer needs to be used in pull mode. It could be the case that streamed data is cached and needs to be
         * processed later as a finite data structure. This method returns the data element at the given index
         * @param index the index of the data item to return
         * @returns {*} the item. null should never be returned cause it has a special meaning within Flow.
         */
        get(index){
            //NOTE: null should never be returned cause it has a special meaning within Flow.
            //If this method returns null it will be swapped with {} and could affect your Flow usage.
            return {};
        }
    }


    /**
     * This class employs the Factory design pattern to create the initial/first Flow from several input types
     */
    class FlowFactory{

        static getFlow(data){
            return new IteratorFlow(FlowFactory.getIterator(data));
        }

        static getIterator(data){
            let iterator;

            //find the type of data passed
            if( Util.isArray(data) && !Util.isString(data) )
                iterator = FlowFactory.createIteratorFromArray(data);
            else if( Util.isMap(data) )
                iterator = FlowFactory.createIteratorFromMap(data);
            else if( Util.isSet(data) )
                iterator = FlowFactory.createIteratorFromSet(data);
            else if( Util.isString(data) && data.toLowerCase().startsWith("fs://") )
                iterator = FlowFactory.createIteratorFromFileSystem(data);
            else if( Util.isStreamer(data) )
                iterator = FlowFactory.createIteratorFromStreamer(data);
            else if( Util.isGenerator(data) )
                iterator = FlowFactory.createIteratorFromGenerator(data);
            else if( Util.isIterable(data) && !Util.isString(data) )
                iterator = FlowFactory.createIteratorFromIterable(data);
            else if( Util.isObject(data) && !Util.isString(data) )
                iterator = FlowFactory.createIteratorFromObject(data);
            else
                iterator = FlowFactory.createIteratorFromValue(data);

            return iterator;
        }

        /**
         *
         * @param array Javascript Array
         */
        static createIteratorFromArray(array){
            return (function(_array){
                let array = _array;
                let index = 0;

                return {
                    next: function(){
                        try {
                            return index < array.length ? {value: array[index], done: false} : {done: true};
                        }
                        finally{
                            index++;
                            if( index > array.length )  //after returning done, reset the iterator
                                index = 0;
                        }
                    }
                };
            })(array);
        }

        /**
         *
         * @param number the number of items to create
         */
        static createIteratorWithEmptyArraysFromNumber(number){
            //create empty arrays of count number
            number = Math.ceil(number); //just in case it is not an integer

            var array = [];
            while( number-- )
                array.push([]);

            return FlowFactory.createIteratorFromArray(array);
        }

        /**
         *
         * @param map Javascript Map object
         */
        static createIteratorFromMap(map){
            return (function(_map){
                let map = _map;
                let entries = map.entries();

                return {
                    next: function(){
                        let entry = entries.next();
                        if( entry.done ) {
                            entries = map.entries();    //reset the map entries iterator just before returning done
                            return entry;
                        }
                        else
                            return {value: {key: entry.value[0], value: entry.value[1]}, done: false};
                    }
                };
            })(map);
        }

        /**
         *
         * @param set Javascript Set object
         * @returns {*}
         */
        static createIteratorFromSet(set){
            return FlowFactory.createIteratorFromArray(Array.from(set));
        }

        /**
         * Create a Flow from any object that implements the Javascript Iterable framework
         * @param iterable the iterable which could be navigated via a next method
         */
        static createIteratorFromIterable(iterable){
            //TODO save state for restarting when Flow is being reused
            return iterable;
        }


        /**
         * Create a Flow from a JS Generator
         * @param gen the JS Generator function
         */
        static createIteratorFromGenerator(gen){
            return (function(_gen){
                let gen = _gen;
                let iterator = gen();
                let elem;

                return {
                    next: function(){
                        try {
                            elem = iterator.next();
                            return elem;
                        }
                        finally{
                            //create a new iterator for reuse. Note that this may not always replicate the initial
                            //state based on how the data is retrieved. It is the responsibility of the programmer
                            //to make this happen if reuse is required.
                            if( elem.done )
                                iterator = gen();
                        }
                    }
                };
            })(gen);
        }


        /**
         * Create a Flow from a Javascript Object, iterating through the properties and creating a property-value pair
         * @param object the JS object
         */
        static createIteratorFromObject(object){
            return (function(_object){
                let object = _object;
                let keys = Object.keys(object);
                let pos = 0;
                let length = keys.length;

                return {
                    next: function(){
                        try {
                            return pos < length ? {value: {key: keys[pos], value: object[keys[pos]]}, done: false} : {done: true};
                        }
                        finally{
                            pos++;
                            if( pos > length ) {  //reset the position to start after the last value is returned
                                pos = 0;
                                //incase the underlying data changes
                                keys = Object.keys(object);
                                length = keys.length;
                            }
                        }
                    }
                };
            })(object);
        }

        /**
         *
         * @param path File System path
         */
        static createIteratorFromFileSystem(path){
            return (function(){
                if( path.trim().substring(0, "fs://".length) == "fs://" )
                    path = path.trim().substring("fs://".length);

                let lineByLine = require('n-readlines');
                let liner = new lineByLine(path);

                return {
                    next: function(){
                        let line = liner.next();

                        if( line )
                            return {value: line.toString("utf8"), done: false};

                        liner = new lineByLine(path);   //reset the line reader iterator just before returning done

                        return {done: true};
                    }
                };
            })();
        }


        /**
         * As opposed to throwing an exception, create a Flow with the value as the only value
         * @param value
         */
        static createIteratorFromValue(value){
            return (function(){
                let used = false;

                return {
                    next: function(){
                        try {
                            return used ? {done: true} : {value: value, done: false};
                        }
                        finally{
                            used = !used;
                        }
                    }
                };
            })();
        }

        /**
         * This method is for regularizing the design
         * @param streamer
         */
        static createIteratorFromStreamer(streamer){
            return (function(){
                let length = streamer.size();
                let nul = {};
                let pos = 0;
                let item;

                return {
                    next: function(){
                        try {
                            if( pos >= length )
                                return  {done: true};
                            item = streamer.get(pos);
                            return {value: item == null ? nul : item, done: false};
                        }
                        finally{
                            pos++;
                            if( pos > length ){
                                pos = 0;    //reset for reuse
                                //if the underlying data size changed
                                length = streamer.size();
                            }
                        }
                    },
                    streamer: streamer
                };
            })();
        }
    }

    var Util = {
        isFunction: function(obj) {
            return typeof obj === 'function' || false;
        },
        isArray: function (obj) {
            return typeof obj.length === 'number' && obj.length >= 0;
        },
        isSet: function(obj) {
            return obj instanceof Set && Util.isFunction(obj.values);
        },
        isMap: function(obj) {
            return obj instanceof Map && Util.isFunction(obj.values);
        },
        isObject: function(obj) {
            return Boolean(obj) && typeof obj === 'object';
        },
        isString: function(obj) {
            return Object.prototype.toString.call(obj) === '[object String]';
        },
        isIn: function(needle, haystack){
            for(let i = 0; i < haystack.length; i++){
                if( needle === haystack[i] )
                    return true;
            }
            return false;
        },
        isNumber: function(obj) {
            return Object.prototype.toString.call(obj) === '[object Number]';
        },
        isIterable: function(obj){
            return Util.isFunction(obj[Symbol.iterator]) || (obj.next && Util.isFunction(obj.next));
        },
        isGenerator: function(obj){//Obtained from: https://stackoverflow.com/a/34103165/8326992
            var GeneratorFunction = (function*(){}).constructor;
            return obj instanceof GeneratorFunction;
        },
        isStreamer: function(obj){
            return obj instanceof Streamer;
        },
        generateUUID: function(){ //Obtained from: https://stackoverflow.com/a/8809472/8326992
            var d = new Date().getTime();
            if (typeof performance !== 'undefined' && typeof performance.now === 'function'){
                d += performance.now(); //use high-precision timer if available
            }
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
                var r = (d + Math.random() * 16) % 16 | 0;
                d = Math.floor(d / 16);
                return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
            });
        }
    };

    //code.stephenmorley.org
    function Queue(){var a=[],b=0;this.getLength=function(){return a.length-b};this.isEmpty=function(){return 0==a.length};this.enqueue=function(b){a.push(b)};this.dequeue=function(){if(0!=a.length){var c=a[b];2*++b>=a.length&&(a=a.slice(b),b=0);return c}};this.peek=function(){return 0<a.length?a[b]:void 0}}

    RichFlow.Flow = Flow;
    RichFlow.InFlow = InFlow;
    RichFlow.OutFlow = OutFlow;
    RichFlow.Streamer = Streamer;

    Object.defineProperty(RichFlow, '__esModule', { value: true });
}));