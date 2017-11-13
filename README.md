# dyn-dns-cloudflare


Tool to update cloudflare dns record


#### Config File

npm should install **dyn-dns-cloudflare** executable in path, if runnong as cron job you may need to
explicitly use full path to node with full path to index.js in this package

#### Config File

    {
      "fqdn": "my-house.example.com",
      "key": "123456789012345678901234567890",
      "email": "barney@rubble.com",
      "log": "/var/dyn-dns-cf.log"
    }

  - fqdn: **required**, fully qualified domain name to be updated
  - key: **required**, cloudflare api key with edit permission 
  - email: **required**, cloudflare email account id
  - log: optional, full path to log file, must be writable for user tool runs under 
  - verbose: optional, truthy value to turn on console log output

#### Parameters

Command line parameters override config file values

`dyn-dns-cloudflare [ options ] [ <fqdn> [ <email> [ <key> ] ] ]`

Options:

 - `-v` or `--verbose` enable verbose mode
 - `-c` or `--config` specify config file path using next argument 

#### Notes

log file is appended and never trimmed, see `logrotate`
