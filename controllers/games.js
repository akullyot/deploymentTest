//REQUIRED IMPORTS/MODULES
const games             = require('express').Router();
const { fourXFourClassic, fourXFourNew, fiveXfiveClassic, sixXsixClassic } = require('../boggleData/dice.js');
const sowpods           = require('pf-sowpods'); //this is the scrabble dictionary package

//HELPER FUNCTIONS

//Purpose: shuffles an array using the Knuth Shuffle
const shuffle = (inputArray) => {
    for (let i = inputArray.length - 1; i > 0; i--) { 
        const j = Math.floor(Math.random() * (i + 1)); 
        [inputArray[i], inputArray[j]] = [inputArray[j], inputArray[i]]; 
      } 
      return inputArray; 
};




//Purpose: generates a new board for the given inputs
games.post('/newgame', async (req, res) => {
    try {
        if (req.body.gameType == 'fourXFourClassic' || req.body.gameType == 'fourXFourNew'){
            //first generate a die0...die15 array and shuffle 
            const diceIndexArray = shuffle(Array.from(Array(16).keys()).map(index => {return('die' + index)}));
            //seed structure: boardType_dieIndexRIdieRollIndex_....etc
            let seed = `4x4_`;
            let dieSet = null;
            if(req.body.gameType === 'fourXFourClassic' ){
                dieSet = fourXFourClassic;
                seed= seed.concat('c_')
            }else{
                dieSet= fourXFourNew;
                seed = seed.concat('n_')
            }
            let boardArray = diceIndexArray.map((die) => {
                const roll = Math.floor(Math.random() *6);
                seed = seed.concat(`${die}R${roll}`);
                return dieSet[die][roll];
            });
            let boardMatrix = [];
            //4x4 2d array
            while(boardArray.length){
                boardMatrix.push(boardArray.splice(0,4))
            };
            return res.status(200).json({seed:seed, boardMatrix:boardMatrix})
        }else{
            //reqrite above to work with 5x5 and 6x6
            throw 'not supported yet'
        }

    } catch (error) {
        console.error(error);
        //TODO this is a guess on the error code
        return res.status(409).json({message: 'board generation failed'})
    }
});

//Purpose: given a seed, generate the correct board
games.post('/joingame', async(req,res) => {
    try {
        let seed = req.body.seed;
        const [ boardSizeKey, diceTypeKey, boardValues] = seed.split("_");
        let dieSet = null;
        let boardSize = null;
        if (boardSizeKey === '4x4'){
            boardSize = 4;
            if(diceTypeKey === 'c' ){
                 dieSet= fourXFourClassic;
            }else{
                dieSet = fourXFourNew;
            }
        }else{
            throw 'die type not supported yet'
        }
        //Make your board array from the seed
        const allDiceKeys = boardValues.split("die"); // 4R4, die 4, side 4
        allDiceKeys.shift();
        let boardArray = [];
        allDiceKeys.forEach(dieKey => {
            let [die, side] = dieKey.split("R");

            boardArray.push(dieSet[`die${die}`][Number(side)])
        });
        let boardMatrix = [];
        //4x4 2d array
        while(boardArray.length){
            boardMatrix.push(boardArray.splice(0,boardSize))
        };
        return res.status(200).json({boardMatrix:boardMatrix})

    } catch (error) {

        res.status(155).json({message:'board generation failed'})
    }
});

//Purpose: using the scrabble dictionary, create a trie and perform a DFS on said trie for each possible board path
games.post('/findallwords', async(req,res) => {
    //TODO make a try catch here
    //We are using a trie approach through the entire dictionary to see if it exists on
    // the board in a valid manner
    //TODO one day I want to make this trie myself, but for right now Ill just use pf-sowpods's trie
    const trie = sowpods.trie; ///The node <path>._ === true indicates an End-of-Word.
    const results = [];
    let board = req.body.boardMatrix.flat();
    let size =  Math.sqrt(board.length); //I only ever do square boards
    //NOTE: this function was heavily helped/ basically just reworked slightly from looking at pf-sowpod's source code,
    // eventually I want to make this from scratch but getting the recursion right was difficult in the time constraint
    function recursiveSolve (index, trieNode, path, sequence) {
        // Dont retrace
        if (sequence.indexOf(index) !== -1) {return}
        // Note: A square on the board may represent multiple characters
        const nodes = board[index].toUpperCase();
        // Crawl the trie
        for (const node of nodes) {
            if (!(trieNode = trieNode[node])) {return}
        }
        // Update variables
        path += nodes
        sequence = sequence.concat([ index ])
        // Check if valid word
        if (trieNode._) {
        results.push({ word: path, sequence: sequence })
        }
        // Recurse on neighboring cells
        const up = index / size | 0
        const down = up !== size - 1
        const left = index % size
        const right = left !== size - 1
    
        up && left && recursiveSolve(index - size - 1, trieNode, path, sequence)
        up && recursiveSolve(index - size, trieNode, path, sequence)
        up && right && recursiveSolve(index - size + 1, trieNode, path, sequence)
        left && recursiveSolve(index - 1, trieNode, path, sequence)
        right && recursiveSolve(index + 1, trieNode, path, sequence)
        down && left && recursiveSolve(index + size - 1, trieNode, path, sequence)
        down && recursiveSolve(index + size, trieNode, path, sequence)
        down && right && recursiveSolve(index + size + 1, trieNode, path, sequence)
    };
    for (let i = 0, l = board.length; i < l; ++i) {
        recursiveSolve(i, trie, '', [])
    }
    validWords = [];
    results.forEach(resultObj => {
        if (resultObj.word.length >= 3){
            if (!validWords.includes(resultObj.word))
            validWords.push(resultObj.word)
        };
    });
     //lets sort the valid words to be by length and alphabetical
    validWords.sort(function(a, b) {
        return a.length - b.length || a.localeCompare(b)
    });
    //now lets get the scores for each word
    const validWordsArrayofObj = validWords.map((word) => {
        //lets get the score
        let thisScore = 0;
        if (word.length === 3 || word.length === 4 ){
             thisScore = 1;
        }else if (word.length === 5){
             thisScore = 2;
        }else if (word.length === 6){
             thisScore = 3;
        }else if (word.length === 7){
             thisScore = 5;
        }else if (word.length >= 8){
             thisScore = 11;
        }
        return ({
            word: word,
            score:  thisScore
        });
    })
    res.status(200).json({wordsArray: validWordsArrayofObj})
});

//Purpose: push results to your database to do data analytics
games.post("/logresults", async(req,res) => {
    //All required information
    //userID
    //seed
    //game Type (get from the seed)
    //dice type (get from the seed)
    //seconds Duration
    //csv wordslist
});




module.exports = games