import express from 'express';

const app = express();

app.use(express.static("public"));
app.use(express.json());
app.use(express.urlencoded({ extended:true}))

app.set("view engine", "ejs");
app.set("port", 3000);

interface Player {
    name: string;
}

let players : Player[] = [];

app.get("/", (req,res) => {
    res.render("index");

})


app.listen(app.get("port"), () => {
    console.log(`Local url: http://localhost:${app.get("port")}`);
})