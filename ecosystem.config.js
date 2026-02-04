module.exports = {
    apps: [{
        name: "mems-client",
        cwd: "./client",
        script: "npm",
        args: "server -s build -l 3000"
    }, {
        name: "mems-server",
        cwd: "./server",
        script: "index.js",
        env:{
            NODE_ENV: "production"
        }
    }]
}