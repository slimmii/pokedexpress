import express from "express";
import axios from "axios";
import { MongoClient, ObjectId } from "mongodb";

const uri = "mongodb+srv://andiesimilon:webontwikkeling@mijncluster.odjft.mongodb.net/myFirstDatabase?retryWrites=true&w=majority";
const client = new MongoClient(uri);

const app = express();

app.use(express.static("public"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.set("view engine", "ejs");
app.set("port", 3000);

interface Pokemon {
    id: number;
    name: string;
    types: string[];
    image: string;
    height: number;
    weight: number;
    maxHp: number;
    currentHp?: number;
}

interface Player {
    _id?: ObjectId;
    name: string;
    pokemon: Pokemon[];
}

let players : Player[] = [];
let allPokemon: Pokemon[] = [];

const updatePlayer = async (player: Player) => {
    try {
        await client.connect();
        await client.db("Webontwikkeling").collection("Player").updateOne({_id: player._id}, {$set: {
            pokemon: player.pokemon
        }});
    } catch (e) {
        console.error(e);
    } finally {
        await client.close()
    }
}

const loadPlayersFromDb = async() => {
    try {
        await client.connect();
        players = await client.db("Webontwikkeling").collection("Player").find<Player>({}).toArray();
    } catch (e) {
        console.error(e);
    } finally {
        await client.close()
    }
}

const getPlayerById = (id: string) => {
    return players.find(p => p._id!.toString() === id);
}

const createPlayer = async (player: Player) => {
    try {
        await client.connect();
        await client.db("Webontwikkeling").collection("Player").insertOne(player);
        await loadPlayersFromDb();
    } catch (e) {
        console.error(e);
    } finally {
        await client.close()
    }
}

app.get("/", async(req, res) => {
    res.render("index", { players: players });
});

app.post("/createPlayer", async (req, res) => {
    let player: Player = {
        name: req.body.name,
        pokemon: [],
    };
    await createPlayer(player);
    res.redirect("/");
});

app.get("/player/:id", async(req, res) => {
    let player = getPlayerById(req.params.id);
    if (!player) {
        return res.status(404).send("Player not found");
    }
    res.render("player", { player: player });
});

app.get("/player/:id/pokemon", async(req, res) => {
    let player = getPlayerById(req.params.id);
    if (!player) {
        return res.status(404).send("Player not found");
    }
    

    let types : string[] = (player.pokemon.length > 0) ? player.pokemon.reduce((prev: string[], curr: Pokemon) => [...prev, ...curr.types.filter((type) => !prev.includes(type))], []) : [];
    let largest = (player.pokemon.length > 0) ? player.pokemon.reduce((prev, curr) => curr.height > prev.height ? curr : prev) : undefined;
    let smallest = (player.pokemon.length > 0) ? player.pokemon.reduce((prev, curr) => curr.height < prev.height ? curr : prev) : undefined;

    let filteredPokemon = allPokemon.filter((pokemon) => !player!.pokemon.find((p) => p.id === pokemon.id));
    if (req.query.filter) {
        filteredPokemon = allPokemon.filter(pokemon => pokemon.types.includes(req.query.filter as string));
    }

    res.render("pokemon", { types: types, smallest: smallest, largest: largest, player: player, allPokemon: filteredPokemon });
});

app.post("/player/:id/save", async(req, res) => {
    let player = getPlayerById(req.params.id);
    if (!player) {
        return res.status(404).send("Player not found");
    }
    await updatePlayer(player);
    res.redirect("/player/" + player._id);
});

app.post("/player/:id/pokemon/add/:pokeId", async(req, res) => {
    let player = getPlayerById(req.params.id);
    let pokemon: Pokemon | undefined = allPokemon.find(p => p.id === parseInt(req.params.pokeId));

    if (!player) {
        return res.status(404).send("Player not found");
    }
    if (!pokemon) {
        return res.status(404).send("Pokemon not found");
    }

    if (pokemon) {
        pokemon.currentHp = Math.floor(Math.random() * pokemon.maxHp);
        player.pokemon = [pokemon, ...player.pokemon.slice(0,5)];
        res.redirect("/player/" + player._id + "/pokemon");
    } else {
        res.status(404).send("Pokemon not found");
    }
});

app.post("/player/:id/pokemon/delete/:pokeId", async (req, res) => {
    let player = getPlayerById(req.params.id);
    if (!player) {
        return res.status(404).send("Player not found");
    }
    player.pokemon = player.pokemon.filter(p => p.id !== parseInt(req.params.pokeId));
    res.redirect("/player/" + player._id + "/pokemon");

});

const loadPokemonFromDb = async () => {
    try {
        await client.connect();
        let dbPokemon = await client.db("Webontwikkeling").collection("Pokemon").find<Pokemon>({}).toArray();
        if (dbPokemon.length > 0) {
            console.log("Pokemon found in db... Loading these");
            allPokemon = dbPokemon;
        } else {
            console.log("Pokemon not found in db... Populating from api");

            let response = await axios.get("https://pokeapi.co/api/v2/pokemon?limit=151");

            for (let p of response.data.results) {
                let response = await axios.get(p.url);
                let maxHp = response.data.stats.find((s: any) => s.stat.name == "hp").base_stat;
                let pokemon: Pokemon = {
                    id: response.data.id,
                    name: response.data.name,
                    types: response.data.types.map((t: any) => t.type.name),
                    image: response.data.sprites.front_default,
                    height: response.data.height,
                    weight: response.data.weight,
                    maxHp: maxHp
                };
                allPokemon = [...allPokemon, pokemon];
            }

            await client.db("Webontwikkeling").collection("Pokemon").insertMany(allPokemon);
        }
    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
};

app.listen(app.get("port"), async () => {
    await loadPokemonFromDb();
    await loadPlayersFromDb();
    console.log(`Local url: http://localhost:${app.get("port")}`);
});
